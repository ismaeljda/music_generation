from typing import List
import modal
import os
import uuid
import base64
from pydantic import BaseModel
import requests
import boto3

from prompts import LYRICS_GENERATOR_PROMPT, PROMPT_GENERATOR_PROMPT

app = modal.App("music-generator")

image = (
    modal.Image.debian_slim()
    .apt_install("git", "ffmpeg")
    .pip_install_from_requirements("requirements.txt")
    .run_commands(["git clone https://github.com/ace-step/ACE-Step.git /tmp/ACE-Step", "cd /tmp/ACE-Step && pip install ."] )
    .env({"HF_HOME": "/.cache/huggingface"} )
    .add_local_python_source("prompts")
    )

model_volume = modal.Volume.from_name("ace-step-models", create_if_missing=True)
hf_volume = modal.Volume.from_name("qwen-hf-cache", create_if_missing=True)

music_gen_secrets = modal.Secret.from_name("music-gen-secret")

class AudioGenerationBase(BaseModel):
    audio_duration: int = 180.0
    seed: int = -1
    guidance_scale: float = 15.0
    infer_step: int = 60
    instrumental: bool = False

class GenerateFromDescriptionRequest(AudioGenerationBase):
    full_described_song: str

class GenerateWithCustomLyricsRequest(AudioGenerationBase):
    prompt: str
    lyrics: str

class GenerateWithDescribedLyricsRequest(AudioGenerationBase):
    prompt: str
    described_lyrics: str

class GenerateMusicResponse(BaseModel):
    audio_data: str

class GenerateMusicResponseS3(BaseModel):
    s3_key: str
    cover_image_s3_key: str
    categories: List[str]

@app.cls(image=image,
         gpu="L40S",
         secrets=[music_gen_secrets],
         volumes={"/.cache/huggingface": hf_volume,
                  "/models": model_volume},
        scaledown_window=15 # Model server will scale down after 15 seconds of inactivity
)
class MusicGenServer:
    @modal.enter()
    def load_model(self):
        from acestep.pipeline_ace_step import ACEStepPipeline
        from transformers import AutoModelForCausalLM, AutoTokenizer
        from diffusers import AutoPipelineForText2Image
        import torch

        # Music generation model
        self.music_model = ACEStepPipeline(
            checkpoint_dir="/models",
            dtype="bfloat16",
            torch_compile=False,
            cpu_offload=False,
            overlapped_decode=False
        )

        # Large language model
        model_id = "Qwen/Qwen2-7B-Instruct"
        self.tokenizer = AutoTokenizer.from_pretrained(model_id)

        self.llm_model = AutoModelForCausalLM.from_pretrained(
            model_id,
            torch_dtype="auto",
            device_map="auto",
            cache_dir="/.cache/huggingface"
        )

        # Stable diffusion model for Thumbnail generation
        self.image_pipe = AutoPipelineForText2Image.from_pretrained(
            "stabilityai/sdxl-turbo",torch_dtype=torch.float16, variant="fp16", cache_dir="/.cache/huggingface")
        self.image_pipe.to("cuda")

    def prompt_qwen(self, question: str) -> str:
        messages = [
            {"role": "user", "content": question}
        ]
        text = self.tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True
        )
        model_inputs = self.tokenizer([text], return_tensors="pt").to(self.llm_model.device)

        generated_ids = self.llm_model.generate(
            model_inputs.input_ids,
            max_new_tokens=512
        )
        generated_ids = [
            output_ids[len(input_ids):] for input_ids, output_ids in zip(model_inputs.input_ids, generated_ids)
        ]

        response = self.tokenizer.batch_decode(generated_ids, skip_special_tokens=True)[0]
        return response
    
    def generate_prompt(self, description: str):
        #insert descritpion into template
        full_prompt = PROMPT_GENERATOR_PROMPT.format(user_prompt=description)
        # run llm to generate prompt
        return self.prompt_qwen(full_prompt)
    
    def generate_lyrics(self, description: str):
        #insert descritpion into template
        full_prompt = LYRICS_GENERATOR_PROMPT.format(description=description)
        # run llm to generate prompt
        return self.prompt_qwen(full_prompt)
    
    def generate_categories(self, description: str) -> List[str]:
        prompt = f"Categorize the following music description into relevant categories. List 3-5 relevant genres or categories as a comma-separated list without any additional text.\n\nDescription: \"{description}\"\n\nCategories:"
        response_text = self.prompt_qwen(prompt)
        categories = [cat.strip() for cat in response_text.split(",") if cat.strip()]
        return categories
    
    def generate_and_upload_to_s3(self, 
            prompt: str, 
            lyrics: str, 
            instrumental: bool,
            audio_duration: float,
            infer_step: int,
            guidance_scale: float,
            seed: int,
            description_for_categories: str
    ) -> GenerateMusicResponseS3:
        final_lyrics = "[instrumental]" if instrumental else lyrics
        print(f"generated lyrics: \n{final_lyrics}")
        print(f"prompt: {prompt}")

        s3_client = boto3.client("s3")
        bucket_name = os.environ["S3_BUCKET_NAME"]

        output_dir = "/tmp/outputs"
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, f"{uuid.uuid4()}.wav")

        self.music_model(
            prompt=prompt,
            lyrics=final_lyrics,
            audio_duration=audio_duration,
            infer_step=infer_step,
            guidance_scale=guidance_scale,
            save_path=output_path,
            manual_seeds=str(seed)
        )
        
        audio_s3_key = f"{uuid.uuid4()}.wav"
        s3_client.upload_file(output_path, bucket_name, audio_s3_key)
        os.remove(output_path)

        #thumbnail generation

        thumbnail_prompt = f"{prompt}, album cover art"
        image = self.image_pipe(
            thumbnail_prompt, num_inference_steps=2, guidance_scale=0.0).images[0]
        image_output_path = os.path.join(output_dir, f"{uuid.uuid4()}.png")
        image.save(image_output_path)

        image_s3_key = f"{uuid.uuid4()}.png"
        s3_client.upload_file(image_output_path, bucket_name, image_s3_key)
        os.remove(image_output_path)


        # categorization
        categories = self.generate_categories(description_for_categories)
        return GenerateMusicResponseS3(
            s3_key=audio_s3_key,
            cover_image_s3_key=image_s3_key,
            categories=categories
        )

    @modal.fastapi_endpoint(method="POST", requires_proxy_auth=True)
    def generate(self) -> GenerateMusicResponse:
        output_dir = "/tmp/outputs"
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, f"{uuid.uuid4()}.wav")

        self.music_model(
            prompt="electronic rap",
            lyrics="[instrumental]" ,
            audio_duration=180,
            infer_step=60,
            guidance_scale=15,
            save_path=output_path
        )

        with open(output_path, "rb") as f:
            audio_bytes = f.read()
        
        audio_b64 = base64.b64encode(audio_bytes).decode('utf-8')

        os.remove(output_path)
        return GenerateMusicResponse(audio_data=audio_b64)
    
    @modal.fastapi_endpoint(method="POST", requires_proxy_auth=True)
    def generate_from_description(self, request: GenerateFromDescriptionRequest) -> GenerateMusicResponseS3:
        # generating a prompt
        prompt = self.generate_prompt(request.full_described_song)

        # generation lyrics
        lyrics = ""
        if not request.instrumental:
            lyrics = self.generate_lyrics(request.full_described_song)
        return self.generate_and_upload_to_s3(
            prompt=prompt,
            lyrics=lyrics,
            description_for_categories=request.full_described_song,
            **request.model_dump(exclude={"full_described_song"})
        )

    @modal.fastapi_endpoint(method="POST", requires_proxy_auth=True)
    def generate_with_lyrics(self, request: GenerateWithCustomLyricsRequest) -> GenerateMusicResponseS3:
        return self.generate_and_upload_to_s3(
            prompt=request.prompt,
            lyrics=request.lyrics,
            description_for_categories=request.prompt,
            **request.model_dump(exclude={"prompt", "lyrics"})
        )

    @modal.fastapi_endpoint(method="POST", requires_proxy_auth=True)
    def generate_with_described_lyrics(self, request: GenerateWithDescribedLyricsRequest) -> GenerateMusicResponseS3:
        # generating lyrics 
        lyrics = self.generate_lyrics(request.described_lyrics)
        return self.generate_and_upload_to_s3(
            prompt=request.prompt,
            lyrics=lyrics,
            description_for_categories=request.prompt,
            **request.model_dump(exclude={"prompt", "described_lyrics"}))


@app.local_entrypoint()
def main():
    server = MusicGenServer()
    endpoint_url = server.generate_with_described_lyrics.get_web_url()
    song_request = GenerateWithDescribedLyricsRequest(
        prompt="upbeat pop song with",  
        described_lyrics="A cheerful tune about sunny days and happiness.")
    
    headers = {
        "Modal-Key": "wk-zsSdBQexVhcdZ1ePXvD9nH",
        "Modal-Secret": "ws-uMEGsGgwUn6ml0Y6nIF7wt"
    }
    song_data = song_request.model_dump()

    response = requests.post(endpoint_url, json=song_data)
    response.raise_for_status()
    result = GenerateMusicResponseS3(**response.json())

    print(f"success: {result.s3_key}, categories: {result.categories}, cover image: {result.cover_image_s3_key}")

