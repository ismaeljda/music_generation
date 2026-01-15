
import { db } from "~/server/db";
import { inngest } from "./client";
import { env } from "~/env";

export const generateSong = inngest.createFunction(
  { id: "generate-song", concurrency:{
    limit: 1,
    key: "event.data.userId",
  },
  onFailure: async ({event, error}) => {
    await db.song.update({
        where: {
            id: event?.data?.event?.data?.songId,
        },
        data: {
            status: "failed",
        }
    })
  }
},
  { event: "generate-song-event" },
  async ({ event, step }) => {
    const {songId} = event.data as {
        songId: string;
        userId: string;
    };

    const {userId, credits, endpoint, body} = await step.run("check-credits", async () => {
        const song = await db.song.findUniqueOrThrow({
            where: { 
                id: songId
            },
            select : {
                user: {
                    select :
                    {
                        id: true,
                        credits: true,
                    }
                },
                prompt: true,
                lyrics : true,
                fullDescribedSong : true,
                describedLyrics : true,
                guidanceScale : true,
                inferSteps : true,
                audioDuration : true,
                seed : true,
                instrumental : true
            }
        });

        type RequestBody = {
            guidance_scale?: number;
            infer_steps?: number;
            audio_duration?: number;
            seed?: number;
            prompts?: string;
            lyrics?: string;
            full_described_song?: string;
            described_lyrics?: string;
            instrumental?: boolean;
        }
        let endpoint = "";
        let body: RequestBody = {};

        const commomParams = {
            guidance_scale: song.guidanceScale ??undefined,
            infer_steps: song.inferSteps ?? undefined,
            audio_duration: song.audioDuration ?? undefined,
            seed: song.seed ?? undefined,
            instrumental: song.instrumental ?? undefined
        }

        // Description of a song
        if(song.fullDescribedSong) {
            endpoint = env.GENERATE_FROM_DESCRIPTION;
            body = {
                full_described_song: song.fullDescribedSong,
                ...commomParams,
            };
        }
            
        //Custom mode: lyrics + prompt
        else if(song.lyrics && song.prompt) {
            endpoint = env.GENERATE_WITH_LYRICS;
            body = {
                lyrics: song.lyrics,
                prompts: song.prompt,
                ...commomParams,
            };
        }
        //custom mode: prompt + described lyrics
        else if (song.describedLyrics && song.prompt) {
            endpoint = env.GENERATE_FROM_DESCRIBED_LYRICS;
            body = {
                described_lyrics: song.describedLyrics,
                prompts: song.prompt,
                ...commomParams,
            };
        }

        return {
            userId: song.user.id, 
            credits: song.user.credits, 
            endpoint: endpoint, 
            body: body };

        });

        if (credits > 0)
        {
            await step.run("set-status-processing", async() => {
                return await db.song.update({
                    where: {
                        id: songId,
                    },
                    data: {
                        status: "processing",
                    },
                });
            });
            
            // Step.fetch permet d'eviter le timeout sur vercel le temps que le model travaille et l'attente se fait en serverless sur inngest
            const response = await step.fetch(endpoint, {
                method: "POST",
                body: JSON.stringify(body),
                headers: {
                    "Content-Type": "application/json",
                    "Modal-Key": env.MODAL_KEY,
                    "Modal-Secret": env.MODAL_SECRET
                }
            }); 

            await step.run("update-song-result", async () => {
                const responseData = response.ok ? ((await response.json()) as {
                    s3_key: string;
                    cover_image_s3_key: string;
                    categories: string[];
                })
                : null;

                await db.song.update({
                    where: {
                        id: songId,
                    },
                    data: {
                        s3Key: responseData?.s3_key,
                        thumbnailS3Key: responseData?.cover_image_s3_key,
                        status: response.ok ? "processed" : "failed", 
                    },
                })

                if (responseData && responseData.categories.length > 0){
                    await db.song.update({
                        where: {
                            id: songId,
                        },
                        data: {
                            categories: {
                                connectOrCreate: responseData.categories.map(
                                    (categoryName) => ({
                                        where: {name: categoryName},
                                        create: {name: categoryName},
                                    }),
                                ),
                            }
                        },
                    })
                }
            })
        return await step.run("deduct-credits", async() => {
            if (!response.ok) return;

            return await db.user.update({
               where: {id: userId,},
                data: {
                    credits : {
                        decrement: 1,
                    },
                }
            })
        })
        }
        else
        {
            await step.run("set-status-no-credits", async() => {
                return await db.song.update({
                    where: {
                        id: songId,
                    },
                    data: {
                        status: "no credits",
                    },
                });
            });
        }
    }
);