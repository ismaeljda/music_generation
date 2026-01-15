"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { Textarea } from "~/components/ui/textarea"
import { Input } from "~/components/ui/input"
import { Button } from "~/components/ui/button"
import { Switch } from "~/components/ui/switch"
import { Plus, Music, Loader2 } from "lucide-react"
import { generateSong, type GenerateRequest } from "~/actions/generation"
import { toast } from "sonner"

const INSPIRATION_PROMPTS = [
  "Lofi chill vibes",
  "Upbeat pop energy",
  "Acoustic ballad",
  "EDM bass drops",
  "Jazz fusion",
  "Orchestral epic"
]

const STYLE_TAGS = [
  "Pop",
  "Rock",
  "Hip Hop",
  "Jazz",
  "Classical",
  "Electronic",
  "R&B",
  "Country",
  "Blues",
  "Reggae"
]

const MAX_DESCRIPTION_LENGTH = 500
const MAX_LYRICS_LENGTH = 3000

interface SongPanelProps {
  onSongCreated?: () => void
}

export function SongPanel({ onSongCreated }: SongPanelProps) {
  const [mode, setMode] = useState<"simple" | "custom">("simple")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [instrumental, setInstrumental] = useState(false)
  const [showLyrics, setShowLyrics] = useState(false)
  const [lyrics, setLyrics] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // Custom mode states
  const [customTitle, setCustomTitle] = useState("")
  const [customLyrics, setCustomLyrics] = useState("")
  const [customInstrumental, setCustomInstrumental] = useState(false)
  const [autoWrite, setAutoWrite] = useState(false)
  const [styles, setStyles] = useState("")

  const handleInspirationClick = (prompt: string) => {
    setDescription((prev) => {
      if (prev.trim() === "") {
        return prompt
      }
      // Vérifier si le tag existe déjà dans la description
      const tags = prev.split(",").map(tag => tag.trim())
      if (tags.includes(prompt)) {
        return prev
      }
      return prev + ", " + prompt
    })
  }

  const handleStyleClick = (style: string) => {
    setStyles((prev) => {
      if (prev.trim() === "") {
        return style
      }
      const tags = prev.split(",").map(tag => tag.trim())
      if (tags.includes(style)) {
        return prev
      }
      return prev + ", " + style
    })
  }

  const handleCreate = async () => {
    setIsLoading(true)

    try {
      if (mode === "simple") {
        // Mode Simple: validation
        if (!title.trim()) {
          toast.error("Please enter a song title")
          setIsLoading(false)
          return
        }

        if (!description.trim()) {
          toast.error("Please describe your song")
          setIsLoading(false)
          return
        }

        const request: GenerateRequest = {
          title: title,
          instrumental: instrumental,
        }

        // Si des lyrics sont fournies, utiliser generate_with_lyrics
        if (showLyrics && lyrics.trim()) {
          request.prompt = description
          request.lyrics = lyrics
          request.category = description
        } else {
          // Sinon, utiliser generate_from_description
          request.fullDescribedSong = description
          request.category = description
        }

        await generateSong(request)
        toast.success("2 songs queued for generation!")

        // Rafraîchir la liste des tracks
        onSongCreated?.()

        // Réinitialiser le formulaire
        setTitle("")
        setDescription("")
        setLyrics("")
        setShowLyrics(false)
        setInstrumental(false)

      } else {
        // Mode Custom: validation
        if (!customTitle.trim()) {
          toast.error("Please enter a song title")
          setIsLoading(false)
          return
        }

        if (!customLyrics.trim()) {
          toast.error(autoWrite ? "Please describe the lyrics" : "Please enter lyrics")
          setIsLoading(false)
          return
        }

        if (!styles.trim()) {
          toast.error("Please add some styles")
          setIsLoading(false)
          return
        }

        const request: GenerateRequest = {
          title: customTitle,
          prompt: styles,
          instrumental: customInstrumental,
          category: styles,
        }

        if (autoWrite) {
          // Auto write: utiliser la description des lyrics
          request.describedlyrics = customLyrics
        } else {
          // Mode manuel: utiliser les lyrics directes
          request.lyrics = customLyrics
        }

        console.log("Generating song with request:", request)
        await generateSong(request)
        toast.success("2 songs queued for generation!")

        // Réinitialiser le formulaire
        setCustomTitle("")
        setCustomLyrics("")
        setStyles("")
        setAutoWrite(false)
        setCustomInstrumental(false)
      }
    } catch (error) {
      console.error("Error generating song:", error)
      toast.error("Failed to generate song. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="h-full w-full">
      <div className="bg-card p-6 h-full overflow-y-auto">
        <Tabs value={mode} onValueChange={(value) => setMode(value as "simple" | "custom")} className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="simple">Simple</TabsTrigger>
            <TabsTrigger value="custom">Custom</TabsTrigger>
          </TabsList>

          <TabsContent value="simple" className="mt-6 space-y-6">
            <div className="space-y-2">
              <label htmlFor="song-title" className="text-sm font-semibold">
                Song Title
              </label>
              <Input
                id="song-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My Awesome Song"
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="song-description" className="text-sm font-semibold">
                Describe your song
              </label>
              <Textarea
                id="song-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A dreamy lofi track with gentle piano melodies and soft rain sounds in the background"
                className="h-[120px] resize-none"
                maxLength={MAX_DESCRIPTION_LENGTH}
              />
              <div className="flex justify-between text-xs">
                <span className={description.length >= MAX_DESCRIPTION_LENGTH ? "text-destructive font-semibold" : "text-muted-foreground"}>
                  {description.length >= MAX_DESCRIPTION_LENGTH && "Maximum length reached!"}
                </span>
                <span className="text-muted-foreground">
                  {description.length}/{MAX_DESCRIPTION_LENGTH}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                className="font-semibold"
                onClick={() => setShowLyrics(!showLyrics)}
              >
                <Plus className="size-4 mr-1" />
                Lyrics
              </Button>

              <div className="flex items-center gap-2">
                <Switch
                  id="instrumental"
                  checked={instrumental}
                  onCheckedChange={setInstrumental}
                />
                <label htmlFor="instrumental" className="text-sm font-semibold cursor-pointer">
                  Instrumental
                </label>
              </div>
            </div>

            {showLyrics && (
              <div className="space-y-2">
                <label htmlFor="lyrics" className="text-sm font-semibold">
                  Lyrics
                </label>
                <Textarea
                  id="lyrics"
                  value={lyrics}
                  onChange={(e) => setLyrics(e.target.value)}
                  placeholder="Enter your lyrics here..."
                  className="h-[200px] resize-none font-mono"
                  maxLength={MAX_LYRICS_LENGTH}
                />
                <div className="flex justify-between text-xs">
                  <span className={lyrics.length >= MAX_LYRICS_LENGTH ? "text-destructive font-semibold" : "text-muted-foreground"}>
                    {lyrics.length >= MAX_LYRICS_LENGTH && "Maximum length reached!"}
                  </span>
                  <span className="text-muted-foreground">
                    {lyrics.length}/{MAX_LYRICS_LENGTH}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Inspiration</h3>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                {INSPIRATION_PROMPTS.map((prompt, index) => (
                  <button
                    key={index}
                    onClick={() => handleInspirationClick(prompt)}
                    className="shrink-0 flex items-center gap-2 p-3 rounded-lg border bg-background hover:bg-accent hover:border-primary transition-colors text-sm font-semibold"
                  >
                    <Plus className="size-4 text-muted-foreground shrink-0" />
                    <span>{prompt}</span>
                  </button>
                ))}
              </div>
            </div>

            <Button
              className="w-full bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-bold text-lg py-6"
              onClick={handleCreate}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-6 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Music className="size-6 mr-2" />
                  Create
                </>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="custom" className="mt-6 space-y-6">
            <div className="space-y-2">
              <label htmlFor="custom-title" className="text-sm font-semibold">
                Song Title
              </label>
              <Input
                id="custom-title"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="My Awesome Song"
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="custom-lyrics" className="text-sm font-semibold">
                  {autoWrite ? "Lyrics Description" : "Lyrics"}
                </label>
                <div className="flex items-center gap-2">
                  <Switch
                    id="auto-write"
                    checked={autoWrite}
                    onCheckedChange={setAutoWrite}
                  />
                  <label htmlFor="auto-write" className="text-sm font-semibold cursor-pointer">
                    Auto write
                  </label>
                </div>
              </div>
              <Textarea
                id="custom-lyrics"
                value={customLyrics}
                onChange={(e) => setCustomLyrics(e.target.value)}
                placeholder={autoWrite ? "Describe what the lyrics should be about..." : "Enter your custom lyrics here..."}
                className="h-[200px] resize-none font-mono"
                maxLength={MAX_LYRICS_LENGTH}
              />
              <div className="flex justify-between text-xs">
                <span className={customLyrics.length >= MAX_LYRICS_LENGTH ? "text-destructive font-semibold" : "text-muted-foreground"}>
                  {customLyrics.length >= MAX_LYRICS_LENGTH && "Maximum length reached!"}
                </span>
                <span className="text-muted-foreground">
                  {customLyrics.length}/{MAX_LYRICS_LENGTH}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="custom-instrumental"
                checked={customInstrumental}
                onCheckedChange={setCustomInstrumental}
              />
              <label htmlFor="custom-instrumental" className="text-sm font-semibold cursor-pointer">
                Instrumental
              </label>
            </div>

            <div className="space-y-2">
              <label htmlFor="styles" className="text-sm font-semibold">
                Styles
              </label>
              <Textarea
                id="styles"
                value={styles}
                onChange={(e) => setStyles(e.target.value)}
                placeholder="Select styles from below or type your own..."
                className="h-[120px] resize-none"
                maxLength={MAX_DESCRIPTION_LENGTH}
              />
              <div className="flex justify-between text-xs">
                <span className={styles.length >= MAX_DESCRIPTION_LENGTH ? "text-destructive font-semibold" : "text-muted-foreground"}>
                  {styles.length >= MAX_DESCRIPTION_LENGTH && "Maximum length reached!"}
                </span>
                <span className="text-muted-foreground">
                  {styles.length}/{MAX_DESCRIPTION_LENGTH}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Style Tags</h3>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                {STYLE_TAGS.map((style, index) => (
                  <button
                    key={index}
                    onClick={() => handleStyleClick(style)}
                    className="shrink-0 flex items-center gap-2 p-3 rounded-lg border bg-background hover:bg-accent hover:border-primary transition-colors text-sm font-semibold"
                  >
                    <Plus className="size-4 text-muted-foreground shrink-0" />
                    <span>{style}</span>
                  </button>
                ))}
              </div>
            </div>

            <Button
              className="w-full bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-bold text-lg py-6"
              onClick={handleCreate}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-6 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Music className="size-6 mr-2" />
                  Create
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
