"use server"

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { inngest } from "~/inngest/client";
import { auth } from "~/lib/auth";
import { db } from "~/server/db";
import {GetObjectCommand, S3Client} from "@aws-sdk/client-s3";
import { env } from "~/env";
import {getSignedUrl} from "@aws-sdk/s3-request-presigner";

export interface GenerateRequest {
    title ?: string;
    prompt ?: string;
    lyrics ?: string;
    fullDescribedSong ?: string;
    describedlyrics ?: string;
    instrumental ?: boolean;
    category ?: string;
}

export async function generateSong(generateRequets: GenerateRequest) {
    const session = await auth.api.getSession({
    headers: await headers(),
    });

    if (!session) redirect("/auth/sign-in");

    const song1 = await queueSong(generateRequets, 7.5, session.user.id);
    const song2 = await queueSong(generateRequets, 15, session.user.id);

    revalidatePath("create");

    return [song1, song2];
}
export async function queueSong(generateRequets: GenerateRequest, guidanceScale: number, userId: string) {

    let title = "Untitled";
    if (generateRequets.title && generateRequets.title.trim()) {
        title = generateRequets.title.trim();
    } else {
        if (generateRequets.describedlyrics) title = generateRequets.describedlyrics
        if (generateRequets.fullDescribedSong) title = generateRequets.fullDescribedSong
        title = title.charAt(0).toUpperCase() + title.slice(1);
    }

    // Préparer les catégories
    const categoryConnectOrCreate = [];
    if (generateRequets.category) {
        const categoryNames = generateRequets.category.split(",").map(c => c.trim()).filter(Boolean);
        for (const name of categoryNames) {
            categoryConnectOrCreate.push({
                where: { name },
                create: { name }
            });
        }
    }

    const song = await db.song.create({
        data: {
            userId: userId,
            title: title,
            prompt: generateRequets.prompt,
            lyrics: generateRequets.lyrics,
            guidanceScale: guidanceScale,
            instrumental: generateRequets.instrumental,
            fullDescribedSong: generateRequets.fullDescribedSong,
            describedLyrics: generateRequets.describedlyrics,
            audioDuration: 180,
            status: "processing",
            categories: {
                connectOrCreate: categoryConnectOrCreate
            }
        },
        include: {
            categories: true
        }
    });

    await inngest.send({
        name: "generate-song-event",
        data: {
            songId: song.id,
            userId: song.userId,
        },
    });

    return song;
}

export async function getPlayUrl(songId: string) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });
    if (!session) redirect("/auth/sign-in");

    const song = await db.song.findFirstOrThrow({
        where: {
            id: songId,
            OR: [
                { userId: session.user.id },
                { published: true }
            ],
            s3Key: {
                not: null
            }
        },
        select: { s3Key: true }
    });

    await db.song.update({
        where: { id: songId },
        data: {
            listenCount: { increment: 1 }
        }
    });

    return getPresignedUrl(song.s3Key!);
}

export async function getPresignedUrl(Key: string) {
    const s3 = new S3Client({
        region: env.AWS_REGION,
        credentials: {
            accessKeyId: env.AWS_KEY_ACCESS_KEY_ID!,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY_ID!,
        },
    });
    const command = new GetObjectCommand({
        Bucket: env.AWS_S3_BUCKET_NAME,
        Key : Key,
    });

    return await getSignedUrl(s3, command, {
        expiresIn: 3600, // 1 hour
    })
}