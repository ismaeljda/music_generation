"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "~/lib/auth"
import { db } from "~/server/db"

export async function publishSong(songId: string) {
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

    // Publier le song
    await db.song.update({
        where: { id: songId },
        data: { published: true }
    })

    revalidatePath("/create")

    return { success: true }
}

export async function unpublishSong(songId: string) {
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

    // Dépublier le song
    await db.song.update({
        where: { id: songId },
        data: { published: false }
    })

    revalidatePath("/create")

    return { success: true }
}
