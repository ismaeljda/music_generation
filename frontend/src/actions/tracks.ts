"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "~/lib/auth"
import { db } from "~/server/db"
import { getPresignedUrl } from "./generation"

export async function getUserTracks() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) redirect("/auth/sign-in")

  const tracks = await db.song.findMany({
    where: {
      userId: session.user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      title: true,
      createdAt: true,
      instrumental: true,
      prompt: true,
      lyrics: true,
      describedLyrics: true,
      fullDescribedSong: true,
      s3Key: true,
      thumbnailS3Key: true,
      status: true,
      published: true,
      audioDuration: true,
      categories: {
        select: {
          name: true,
        },
      },
      user: {
        select: {
          name: true,
        },
      },
    },
  })

  // Generate presigned URLs for S3 files
  const tracksWithUrls = await Promise.all(
    tracks.map(async (track) => ({
      ...track,
      category: track.categories.map(c => c.name).join(", "),
      createdByUserName: track.user.name,
      thumbnailUrl: track.thumbnailS3Key
        ? await getPresignedUrl(track.thumbnailS3Key)
        : null,
      playUrl: track.s3Key
        ? await getPresignedUrl(track.s3Key)
        : null,
    }))
  )

  return tracksWithUrls
}

export async function renameSong(songId: string, newTitle: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) redirect("/auth/sign-in")

  // Vérifier que l'utilisateur est le propriétaire
  const song = await db.song.findUnique({
    where: { id: songId },
    select: { userId: true }
  })

  if (!song || song.userId !== session.user.id) {
    throw new Error("Unauthorized")
  }

  // Renommer le song
  await db.song.update({
    where: { id: songId },
    data: { title: newTitle.trim() }
  })

  return { success: true }
}
