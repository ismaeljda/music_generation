import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "~/lib/auth";
import { getTrendingSongs, getSongsByCategory, getAllCategories, checkIfLiked } from "~/actions/discover";
import { DiscoverPage } from "~/components/discover/discover-page";

export default async function HomePage() {
    const session = await auth.api.getSession({headers: await headers()})

    if (!session) {
        redirect("/auth/sign-in");
    }

    const [trendingSongs, categories] = await Promise.all([
        getTrendingSongs(10),
        getAllCategories(),
    ])

    // Get songs by category
    const songsByCategory = await Promise.all(
        categories.slice(0, 5).map(async (category) => ({
            category: category.name,
            songs: await getSongsByCategory(category.name, 10),
        }))
    )

    // Check if user has liked each song
    const trendingSongsWithLikes = await Promise.all(
        trendingSongs.map(async (song) => ({
            ...song,
            isLiked: await checkIfLiked(song.id),
        }))
    )

    const songsByCategoryWithLikes = await Promise.all(
        songsByCategory.map(async (section) => ({
            ...section,
            songs: await Promise.all(
                section.songs.map(async (song) => ({
                    ...song,
                    isLiked: await checkIfLiked(song.id),
                }))
            ),
        }))
    )

    return (
        <DiscoverPage
            trendingSongs={trendingSongsWithLikes}
            songsByCategory={songsByCategoryWithLikes}
        />
    )
}