"use client"

import { useState } from "react"
import Image from "next/image"
import { Heart, Play, Eye } from "lucide-react"
import { Button } from "~/components/ui/button"
import { toggleLike } from "~/actions/discover"
import { toast } from "sonner"

interface SongCardProps {
  id: string
  title: string
  artistName: string
  thumbnailUrl: string | null
  listenCount: number
  likeCount: number
  isLiked: boolean
  onPlay: () => void
}

export function SongCard({
  id,
  title,
  artistName,
  thumbnailUrl,
  listenCount,
  likeCount,
  isLiked: initialIsLiked,
  onPlay,
}: SongCardProps) {
  const [isLiked, setIsLiked] = useState(initialIsLiked)
  const [currentLikeCount, setCurrentLikeCount] = useState(likeCount)
  const [isLiking, setIsLiking] = useState(false)

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation()

    if (isLiking) return

    setIsLiking(true)
    const previousState = isLiked
    const previousCount = currentLikeCount

    // Optimistic update
    setIsLiked(!isLiked)
    setCurrentLikeCount(prev => isLiked ? prev - 1 : prev + 1)

    try {
      await toggleLike(id)
    } catch (error) {
      // Revert on error
      setIsLiked(previousState)
      setCurrentLikeCount(previousCount)
      toast.error("Failed to update like")
      console.error(error)
    } finally {
      setIsLiking(false)
    }
  }

  return (
    <div className="group relative bg-card rounded-lg overflow-hidden border hover:border-primary transition-all cursor-pointer">
      {/* Thumbnail */}
      <div className="relative aspect-square bg-muted" onClick={onPlay}>
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={title}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Play className="size-12 text-muted-foreground" />
          </div>
        )}

        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
          <Button
            size="lg"
            className="opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
            onClick={onPlay}
          >
            <Play className="size-6" />
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        <div>
          <h3 className="font-semibold text-sm truncate">{title}</h3>
          <p className="text-xs text-muted-foreground truncate">{artistName}</p>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Eye className="size-3" />
              <span>{listenCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <Heart className="size-3" />
              <span>{currentLikeCount}</span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleLike}
            disabled={isLiking}
          >
            <Heart
              className={`size-4 transition-colors ${
                isLiked ? "fill-red-500 text-red-500" : ""
              }`}
            />
          </Button>
        </div>
      </div>
    </div>
  )
}
