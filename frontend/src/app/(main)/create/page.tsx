"use client"

import { SongPanel } from "~/components/create/song-panel"
import { TrackList, type track } from "~/components/create/track-list"
import { AudioBar } from "~/components/create/audio-bar"
import { getUserTracks } from "~/actions/tracks"
import { useEffect, useState } from "react"

export default function CreatePage() {
  const [tracks, setTracks] = useState<Awaited<ReturnType<typeof getUserTracks>>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentTrack, setCurrentTrack] = useState<track | null>(null)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)

  const loadTracks = async () => {
    setIsLoading(true)
    try {
      const data = await getUserTracks()
      setTracks(data)

      // Si aucun track n'est sélectionné et qu'il y a des tracks disponibles
      // Sélectionner le premier track processed
      if (!currentTrack && data.length > 0) {
        const firstProcessedTrack = data.find(t => t.status === "processed" && t.playUrl)
        if (firstProcessedTrack) {
          setCurrentTrack(firstProcessedTrack)
        }
      }
    } catch (error) {
      console.error("Failed to load tracks:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadTracks()
  }, [])

  // Auto-refresh when there are processing tracks
  useEffect(() => {
    const hasProcessingTracks = tracks.some(
      track => track.status === "processing" || track.status === "queued"
    )

    if (!hasProcessingTracks) return

    // Poll every 5 seconds
    const interval = setInterval(() => {
      loadTracks()
    }, 5000)

    return () => clearInterval(interval)
  }, [tracks])

  const handleTrackPlay = (track: track, audio: HTMLAudioElement) => {
    // Si c'est le même track, toggle play/pause
    if (currentTrack?.id === track.id && audioElement) {
      if (audioElement.paused) {
        audioElement.play()
        setIsAudioPlaying(true)
      } else {
        audioElement.pause()
        setIsAudioPlaying(false)
      }
      return
    }

    // Arrêter l'ancien audio
    if (audioElement) {
      audioElement.pause()
      audioElement.currentTime = 0
    }

    // Démarrer le nouveau
    audio.play()
    setCurrentTrack(track)
    setAudioElement(audio)
    setIsAudioPlaying(true)

    // Écouter les changements d'état
    audio.onplay = () => setIsAudioPlaying(true)
    audio.onpause = () => setIsAudioPlaying(false)
  }

  const handlePlayFromBar = () => {
    // Si un audio existe déjà, toggle play/pause
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

    // Sinon, créer un nouvel audio pour le currentTrack
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
      <div className="h-full flex flex-col lg:flex-row pb-32">
        {/* Left side - Song Panel */}
        <div className="flex-1 w-full min-w-0 h-full">
          <SongPanel onSongCreated={loadTracks} />
        </div>

        {/* Right side - Track List */}
        <div className="flex-1 w-full min-w-0 h-full border-l">
          <TrackList
            tracks={tracks}
            onRefresh={loadTracks}
            onTrackPlay={handleTrackPlay}
            currentPlayingId={currentTrack?.id}
            isAudioPlaying={isAudioPlaying}
            onPublishToggle={loadTracks}
          />
        </div>
      </div>

      {/* Audio Bar - Full Width at Bottom */}
      {currentTrack && (
        <AudioBar
          track={currentTrack}
          audioElement={audioElement}
          isPlaying={isAudioPlaying}
          onPlayPause={handlePlayFromBar}
          onClose={handleCloseAudioBar}
        />
      )}
    </>
  )
}
