"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "~/components/ui/button"
import { Play, Pause, Volume2, VolumeX, MoreVertical, Download } from "lucide-react"
import Image from "next/image"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { getPlayUrl } from "~/actions/generation"
import { toast } from "sonner"
import type { track } from "./track-list"

interface AudioBarProps {
    track: track
    audioElement: HTMLAudioElement | null
    isPlaying: boolean
    onPlayPause: () => void
    onClose: () => void
}

export function AudioBar({ track, audioElement, isPlaying, onPlayPause, onClose }: AudioBarProps) {
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [volume, setVolume] = useState(1)
    const [isMuted, setIsMuted] = useState(false)
    const progressRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!audioElement) return

        const updateTime = () => setCurrentTime(audioElement.currentTime)
        const updateDuration = () => setDuration(audioElement.duration)
        const handleEnded = () => {
            setCurrentTime(0)
            onClose()
        }

        audioElement.addEventListener('timeupdate', updateTime)
        audioElement.addEventListener('loadedmetadata', updateDuration)
        audioElement.addEventListener('ended', handleEnded)

        return () => {
            audioElement.removeEventListener('timeupdate', updateTime)
            audioElement.removeEventListener('loadedmetadata', updateDuration)
            audioElement.removeEventListener('ended', handleEnded)
        }
    }, [audioElement, onClose])

    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!audioElement || !progressRef.current) return
        const rect = progressRef.current.getBoundingClientRect()
        const percent = (e.clientX - rect.left) / rect.width
        audioElement.currentTime = percent * duration
    }

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value)
        setVolume(newVolume)
        if (audioElement) {
            audioElement.volume = newVolume
        }
        if (newVolume === 0) {
            setIsMuted(true)
        } else if (isMuted) {
            setIsMuted(false)
        }
    }

    const toggleMute = () => {
        if (!audioElement) return
        const newMuted = !isMuted
        setIsMuted(newMuted)
        audioElement.muted = newMuted
    }

    const formatTime = (seconds: number) => {
        if (isNaN(seconds)) return "0:00"
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const handleDownload = async () => {
        if (!track.playUrl) {
            toast.error("No audio file available")
            return
        }

        const toastId = toast.loading("Preparing download...")

        try {
            const url = await getPlayUrl(track.id)

            const a = document.createElement('a')
            a.href = url
            a.download = `${track.title || 'track'}.mp3`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)

            toast.success("Download started!", { id: toastId })
        } catch (error) {
            toast.error("Failed to download track", { id: toastId })
            console.error(error)
        }
    }

    return (
        <div className="fixed bottom-0 left-0 md:left-64 right-0 border-t bg-background z-50">
            <div className="container mx-auto px-6 py-4">
                <div className="space-y-3">
                    {/* Track Info & Controls */}
                    <div className="flex items-center gap-4">
                        {/* Thumbnail */}
                        {track.thumbnailUrl && (
                            <div className="shrink-0 size-14 rounded overflow-hidden">
                                <Image
                                    src={track.thumbnailUrl}
                                    alt={track.title || "Track"}
                                    width={56}
                                    height={56}
                                    className="object-cover"
                                    unoptimized
                                />
                            </div>
                        )}

                        {/* Title & Artist */}
                        <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm truncate">
                                {track.title || "Untitled"}
                            </h4>
                            <p className="text-xs text-muted-foreground truncate">
                                {track.createdByUserName ? (
                                    <>
                                        {track.createdByUserName} • {track.category || "No category"}
                                    </>
                                ) : (
                                    track.category || "No category"
                                )}
                            </p>
                        </div>

                        {/* Play/Pause Button */}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onPlayPause}
                            className="shrink-0"
                        >
                            {isPlaying ? (
                                <Pause className="size-5" />
                            ) : (
                                <Play className="size-5" />
                            )}
                        </Button>

                        {/* Time */}
                        <div className="text-xs text-muted-foreground shrink-0 min-w-[100px] text-center">
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </div>

                        {/* Volume Control */}
                        <div className="flex items-center gap-2 shrink-0">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={toggleMute}
                            >
                                {isMuted || volume === 0 ? (
                                    <VolumeX className="size-4" />
                                ) : (
                                    <Volume2 className="size-4" />
                                )}
                            </Button>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={isMuted ? 0 : volume}
                                onChange={handleVolumeChange}
                                className="w-24 h-1 bg-black/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-black [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-black [&::-moz-range-thumb]:border-0"
                            />
                        </div>

                        {/* Dropdown Menu */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                    <MoreVertical className="size-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={handleDownload}>
                                    <Download className="size-4 mr-2" />
                                    Download
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Progress Bar */}
                    <div
                        ref={progressRef}
                        onClick={handleProgressClick}
                        className="h-2 bg-muted rounded-full cursor-pointer relative overflow-hidden group"
                    >
                        <div
                            className="h-full bg-primary transition-all rounded-full"
                            style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
                        />
                        <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                </div>
            </div>
        </div>
    )
}
