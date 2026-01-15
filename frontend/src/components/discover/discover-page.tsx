"use client"

import { useState } from "react"
import { SongCard } from "./song-card"
import { Button } from "~/components/ui/button"
import { ChevronRight } from "lucide-react"
import { AudioBar } from "~/components/create/audio-bar"

interface Song {
  id: string
  title: string
  artistName: string
  thumbnailUrl: string | null
  playUrl: string | null
  listenCount: number
  likeCount: number
  isLiked: boolean
}

interface DiscoverPageProps {
  trendingSongs: Song[]
  songsByCategory: {
    category: string
    songs: Song[]
  }[]
}

export function DiscoverPage({ trendingSongs, songsByCategory }: DiscoverPageProps) {
  const [currentTrack, setCurrentTrack] = useState<Song | null>(null)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)

  const handlePlay = (song: Song) => {
    if (currentTrack?.id === song.id && audioElement) {
      if (audioElement.paused) {
        audioElement.play()
        setIsAudioPlaying(true)
      } else {
        audioElement.pause()
        setIsAudioPlaying(false)
      }
      return
    }

    if (audioElement) {
      audioElement.pause()
      audioElement.currentTime = 0
    }

    if (song.playUrl) {
      const audio = new Audio(song.playUrl)
      audio.play()
      setCurrentTrack(song as any)
      setAudioElement(audio)
      setIsAudioPlaying(true)

      audio.onplay = () => setIsAudioPlaying(true)
      audio.onpause = () => setIsAudioPlaying(false)
      audio.onended = () => {
        setIsAudioPlaying(false)
        setAudioElement(null)
      }
    }
  }

  const handlePlayFromBar = () => {
    if (audioElement) {
      if (audioElement.paused) {
        audioElement.play()
        setIsAudioPlaying(true)
      } else {
        audioElement.pause()
        setIsAudioPlaying(false)
      }
      return
    }

    if (currentTrack?.playUrl) {
      const audio = new Audio(currentTrack.playUrl)
      audio.play()
      setAudioElement(audio)
      setIsAudioPlaying(true)
      audio.onplay = () => setIsAudioPlaying(true)
      audio.onpause = () => setIsAudioPlaying(false)
      audio.onended = () => {
        setIsAudioPlaying(false)
        setAudioElement(null)
      }
    }
  }

  const handleCloseAudioBar = () => {
    if (audioElement) {
      audioElement.pause()
      audioElement.currentTime = 0
    }
    setCurrentTrack(null)
    setAudioElement(null)
    setIsAudioPlaying(false)
  }

  return (
    <>
      <div className="h-full overflow-y-auto pb-32">
        <div className="p-6 space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-4xl font-bold">Discover Music</h1>
            <p className="text-muted-foreground mt-2">
              Explore trending tracks and discover new music by category
            </p>
          </div>

          {/* Trending Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Trending</h2>
              <Button variant="ghost" size="sm">
                View All
                <ChevronRight className="size-4 ml-1" />
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {trendingSongs.map((song) => (
                <SongCard
                  key={song.id}
                  id={song.id}
                  title={song.title}
                  artistName={song.artistName}
                  thumbnailUrl={song.thumbnailUrl}
                  listenCount={song.listenCount}
                  likeCount={song.likeCount}
                  isLiked={song.isLiked}
                  onPlay={() => handlePlay(song)}
                />
              ))}
            </div>
          </section>

          {/* Category Sections */}
          {songsByCategory.map((section) => (
            <section key={section.category}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">{section.category}</h2>
                <Button variant="ghost" size="sm">
                  View All
                  <ChevronRight className="size-4 ml-1" />
                </Button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {section.songs.map((song) => (
                  <SongCard
                    key={song.id}
                    id={song.id}
                    title={song.title}
                    artistName={song.artistName}
                    thumbnailUrl={song.thumbnailUrl}
                    listenCount={song.listenCount}
                    likeCount={song.likeCount}
                    isLiked={song.isLiked}
                    onPlay={() => handlePlay(song)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* Audio Bar */}
      {currentTrack && (
        <AudioBar
          track={currentTrack as any}
          audioElement={audioElement}
          isPlaying={isAudioPlaying}
          onPlayPause={handlePlayFromBar}
          onClose={handleCloseAudioBar}
        />
      )}
    </>
  )
}
