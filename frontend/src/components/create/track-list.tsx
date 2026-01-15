"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "~/components/ui/input"
import { Button } from "~/components/ui/button"
import { RefreshCw, Search, X, Loader2, CheckCircle, Clock, AlertCircle, Coins, Play, Pause, Volume2, VolumeX, Upload, MoreVertical, Download, Pencil, Music, ChevronLeft, ChevronRight } from "lucide-react"
import Image from "next/image"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { publishSong, unpublishSong } from "~/actions/publish"
import { getPlayUrl } from "~/actions/generation"
import { renameSong } from "~/actions/tracks"
import { toast } from "sonner"

export interface track {
    id: string;
    title: string | null;
    createdAt: Date;
    instrumental: boolean;
    prompt?: string | null;
    lyrics?: string | null;
    describedLyrics?: string | null;
    fullDescribedSong?: string | null;
    thumbnailUrl?: string | null;
    playUrl?: string | null;
    status: string | null;
    createdByUserName?: string | null;
    published: boolean;
    category?: string | null;
    audioDuration?: number | null;
}

interface TrackListProps {
    tracks: track[];
    onRefresh: () => void;
    onTrackPlay?: (track: track, audio: HTMLAudioElement) => void;
    currentPlayingId?: string | null;
    isAudioPlaying?: boolean;
    onPublishToggle?: () => void;
}

function TrackStatusIcon({ status }: { status: string | null }) {
    switch (status) {
        case "failed":
            return <X className="size-5 text-red-500" />
        case "no credits":
            return <Coins className="size-5 text-orange-500" />
        case "processing":
        case "queued":
            return <Loader2 className="size-5 text-blue-500 animate-spin" />
        case "processed":
            return <CheckCircle className="size-5 text-green-500" />
        default:
            return <Clock className="size-5 text-gray-500" />
    }
}

function TrackStatusText({ status }: { status: string | null }) {
    switch (status) {
        case "failed":
            return <span className="text-red-500 text-sm font-semibold">Generation failed - Please try creating song again</span>
        case "no credits":
            return <span className="text-orange-500 text-sm font-semibold">No credits available</span>
        case "processing":
            return <span className="text-blue-500 text-sm font-semibold">Processing...</span>
        case "queued":
            return <span className="text-blue-500 text-sm font-semibold">Queued</span>
        case "processed":
            return null
        default:
            return <span className="text-gray-500 text-sm">{status}</span>
    }
}

export function TrackList({ tracks, onRefresh, onTrackPlay, currentPlayingId, isAudioPlaying, onPublishToggle }: TrackListProps) {
    const [searchQuery, setSearchQuery] = useState("")
    const [publishingIds, setPublishingIds] = useState<Set<string>>(new Set())
    const [renameDialogOpen, setRenameDialogOpen] = useState(false)
    const [trackToRename, setTrackToRename] = useState<track | null>(null)
    const [newTitle, setNewTitle] = useState("")
    const [isRenaming, setIsRenaming] = useState(false)
    const [currentPage, setCurrentPage] = useState(1)
    const tracksPerPage = 10

    const filteredTracks = tracks.filter((track) => {
        const title = track.title || "Untitled"
        return title.toLowerCase().includes(searchQuery.toLowerCase())
    })

    // Pagination
    const totalPages = Math.ceil(filteredTracks.length / tracksPerPage)
    const startIndex = (currentPage - 1) * tracksPerPage
    const endIndex = startIndex + tracksPerPage
    const currentTracks = filteredTracks.slice(startIndex, endIndex)

    // Reset to page 1 when search changes
    useEffect(() => {
        setCurrentPage(1)
    }, [searchQuery])

    const handlePlayPause = (track: track) => {
        if (!track.playUrl || !onTrackPlay) return
        const audio = new Audio(track.playUrl)
        onTrackPlay(track, audio)
    }

    const isPlaying = (trackId: string) => {
        return currentPlayingId === trackId && isAudioPlaying
    }

    const handlePublishToggle = async (track: track) => {
        if (track.status !== "processed") {
            toast.error("Can only publish completed tracks")
            return
        }

        setPublishingIds(prev => new Set(prev).add(track.id))

        try {
            if (track.published) {
                await unpublishSong(track.id)
                toast.success("Track unpublished")
            } else {
                await publishSong(track.id)
                toast.success("Track published!")
            }
            onPublishToggle?.()
            onRefresh()
        } catch (error) {
            toast.error("Failed to update track")
            console.error(error)
        } finally {
            setPublishingIds(prev => {
                const newSet = new Set(prev)
                newSet.delete(track.id)
                return newSet
            })
        }
    }

    const handleDownload = async (track: track) => {
        if (!track.playUrl) {
            toast.error("No audio file available")
            return
        }

        const toastId = toast.loading("Preparing download...")

        try {
            const url = await getPlayUrl(track.id)

            // Créer un lien temporaire et déclencher le téléchargement
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

    const openRenameDialog = (track: track) => {
        setTrackToRename(track)
        setNewTitle(track.title || "")
        setRenameDialogOpen(true)
    }

    const handleRename = async () => {
        if (!trackToRename || !newTitle.trim()) {
            toast.error("Please enter a valid title")
            return
        }

        setIsRenaming(true)

        try {
            await renameSong(trackToRename.id, newTitle)
            toast.success("Track renamed successfully!")
            setRenameDialogOpen(false)
            onRefresh()
        } catch (error) {
            toast.error("Failed to rename track")
            console.error(error)
        } finally {
            setIsRenaming(false)
        }
    }

    return (
        <div className="h-full flex flex-col bg-card">
            {/* Header */}
            <div className="p-4 border-b space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold">Your Tracks</h2>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onRefresh}
                        className="gap-2"
                    >
                        <RefreshCw className="size-4" />
                        Refresh
                    </Button>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by title..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            {/* Track List */}
            <div className="flex-1 flex flex-col">
                <div className="flex-1 overflow-y-auto p-4">
                    {currentTracks.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground gap-4">
                            <Music className="size-16 opacity-20" />
                            <div>
                                <p className="text-lg font-semibold">
                                    {searchQuery ? "No tracks found" : "No music yet"}
                                </p>
                                <p className="text-sm">
                                    {searchQuery ? "Try searching for something else" : "Create your first song to get started!"}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                        {currentTracks.map((track) => (
                        <div
                            key={track.id}
                            className="flex gap-3 p-3 rounded-lg border bg-background hover:bg-accent transition-colors"
                        >
                            {/* Thumbnail */}
                            <div className="shrink-0 size-16 rounded-md overflow-hidden bg-muted flex items-center justify-center relative">
                                {track.thumbnailUrl ? (
                                    <>
                                        <Image
                                            src={track.thumbnailUrl}
                                            alt={track.title || "Track"}
                                            width={64}
                                            height={64}
                                            className="object-cover"
                                            unoptimized
                                        />
                                        {track.playUrl && track.status === "processed" && (
                                            <button
                                                onClick={() => handlePlayPause(track)}
                                                className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                                            >
                                                {isPlaying(track.id) ? (
                                                    <Pause className="size-6 text-white" />
                                                ) : (
                                                    <Play className="size-6 text-white" />
                                                )}
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <TrackStatusIcon status={track.status} />
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold truncate">
                                    {track.title || "Untitled"}
                                </h3>
                                <TrackStatusText status={track.status} />
                                {track.category && (
                                    <div className="flex gap-1 flex-wrap mt-1">
                                        {track.category.split(",").map((tag, index) => (
                                            <span
                                                key={index}
                                                className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full"
                                            >
                                                {tag.trim()}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                    <p className="text-xs text-muted-foreground">
                                        {new Date(track.createdAt).toLocaleDateString()}
                                    </p>
                                    {track.audioDuration && (
                                        <>
                                            <span className="text-xs text-muted-foreground">•</span>
                                            <p className="text-xs text-muted-foreground">
                                                {Math.floor(track.audioDuration / 60)}:{String(Math.floor(track.audioDuration % 60)).padStart(2, '0')}
                                            </p>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            {track.status === "processed" && (
                                <div className="flex items-center gap-2 shrink-0">
                                    {/* Publish Button */}
                                    <Button
                                        variant={track.published ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => handlePublishToggle(track)}
                                        disabled={publishingIds.has(track.id)}
                                    >
                                        {publishingIds.has(track.id) ? (
                                            <Loader2 className="size-4 animate-spin mr-2" />
                                        ) : null}
                                        {track.published ? "Published" : "Publish"}
                                    </Button>

                                    {/* Dropdown Menu */}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm">
                                                <MoreVertical className="size-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => openRenameDialog(track)}>
                                                <Pencil className="size-4 mr-2" />
                                                Rename
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleDownload(track)}>
                                                <Download className="size-4 mr-2" />
                                                Download
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            )}
                        </div>
                    ))}
                    </div>
                )}
                </div>

                {/* Pagination */}
                {filteredTracks.length > 0 && totalPages > 1 && (
                    <div className="border-t p-4 flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                            Page {currentPage} of {totalPages} ({filteredTracks.length} tracks)
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft className="size-4" />
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                            >
                                Next
                                <ChevronRight className="size-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Rename Dialog */}
            <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Rename Track</DialogTitle>
                        <DialogDescription>
                            Enter a new name for "{trackToRename?.title}"
                        </DialogDescription>
                    </DialogHeader>
                    <Input
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="Track name"
                        maxLength={100}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleRename()
                            }
                        }}
                    />
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setRenameDialogOpen(false)}
                            disabled={isRenaming}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleRename}
                            disabled={isRenaming || !newTitle.trim()}
                        >
                            {isRenaming ? (
                                <>
                                    <Loader2 className="size-4 mr-2 animate-spin" />
                                    Renaming...
                                </>
                            ) : (
                                "Rename"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}