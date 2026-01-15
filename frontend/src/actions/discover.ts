"use server"

import { headers } from "next/headers"
import { auth } from "~/lib/auth"
import { db } from "~/server/db"
import { getPresignedUrl } from "./generation"

export async function getTrendingSongs(limit = 10) {
  const songs = await db.song.findMany({
    where: {
      published: true,
      status: "processed",
    },
    orderBy: [
      { listenCount: "desc" },
      { createdAt: "desc" },
    ],
    take: limit,
    select: {
      id: true,
      title: true,
      s3Key: true,
      thumbnailS3Key: true,
      listenCount: true,
      user: {
        select: {
          name: true,
        },
      },
      _count: {
        select: {
          likes: true,
        },
      },
    },
  })

  const songsWithUrls = await Promise.all(
    songs.map(async (song) => ({
      ...song,
      artistName: song.user.name,
      likeCount: song._count.likes,
      thumbnailUrl: song.thumbnailS3Key
        ? await getPresignedUrl(song.thumbnailS3Key)
        : null,
      playUrl: song.s3Key
        ? await getPresignedUrl(song.s3Key)
        : null,
    }))
  )

  return songsWithUrls
}

export async function getSongsByCategory(categoryName: string, limit = 10) {
  const songs = await db.song.findMany({
    where: {
      published: true,
      status: "processed",
      categories: {
        some: {
          name: categoryName,
        },
      },
    },
    orderBy: [
      { listenCount: "desc" },
      { createdAt: "desc" },
    ],
    take: limit,
    select: {
      id: true,
      title: true,
      s3Key: true,
      thumbnailS3Key: true,
      listenCount: true,
      user: {
        select: {
          name: true,
        },
      },
      _count: {
        select: {
          likes: true,
        },
      },
    },
  })

  const songsWithUrls = await Promise.all(
    songs.map(async (song) => ({
      ...song,
      artistName: song.user.name,
      likeCount: song._count.likes,
      thumbnailUrl: song.thumbnailS3Key
        ? await getPresignedUrl(song.thumbnailS3Key)
        : null,
      playUrl: song.s3Key
        ? await getPresignedUrl(song.s3Key)
        : null,
    }))
  )

  return songsWithUrls
}

export async function getAllCategories() {
  const categories = await db.category.findMany({
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          songs: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  })

  return categories.filter(cat => cat._count.songs > 0)
}

export async function toggleLike(songId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    throw new Error("Not authenticated")
  }

  const existingLike = await db.like.findUnique({
    where: {
      userId_songId: {
        userId: session.user.id,
        songId: songId,
      },
    },
  })

  if (existingLike) {
    // Unlike
    await db.like.delete({
      where: {
        userId_songId: {
          userId: session.user.id,
          songId: songId,
        },
      },
    })
    return { liked: false }
  } else {
    // Like
    await db.like.create({
      data: {
        userId: session.user.id,
        songId: songId,
      },
    })
    return { liked: true }
  }
}

export async function checkIfLiked(songId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    return false
  }

  const like = await db.like.findUnique({
    where: {
      userId_songId: {
        userId: session.user.id,
        songId: songId,
      },
    },
  })

  return !!like
}
