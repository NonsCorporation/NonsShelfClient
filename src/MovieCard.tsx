import { IoIosFilm } from "react-icons/io";
import { IoEllipsisHorizontal } from "react-icons/io5";
import CarouselText from "./CarouselText";

type MovieCardProps = {
    title: string
    author: string
    director?: string
    actors?: string[]
    genre?: string[]
    rating?: number | string
    year?: number
    duration?: string
    description?: string
    coverUrl?: string
    tags?: string[]
    onEdit?: () => void
}

export default function MovieCard({ title, director, actors, genre, year, duration, coverUrl, tags, onEdit }: MovieCardProps) {
    return (
        <div className="w-48 h-[340px] bg-nonscontainerbg rounded-sm group overflow-hidden cursor-pointer flex flex-col border border-white/5 hover:bg-white/5 hover:border-white/10 transition-all duration-300">
            {/* cover image container */}
            <div className="relative w-full aspect-[2/3] overflow-hidden rounded-sm bg-gray-800 shadow-md">
                <div className="absolute inset-0 transition-colors duration-300 group-hover:bg-black/10 z-10" />

                {/* year badge (top-left) */}
                <div className="absolute top-2.5 left-2.5 z-30 flex flex-col gap-1 items-start">
                    {year && (
                        <div className="bg-black/70 backdrop-blur-md px-1.5 py-0.5 rounded text-[11px] font-medium text-white/90 shadow-sm border border-white/10">
                            {year}
                        </div>
                    )}
                    {tags && tags.length > 0 && tags.map(t => (
                        <div key={t} className="bg-nonsprimary/90 text-white px-1.5 py-0.5 rounded text-[10px] font-semibold backdrop-blur-md shadow-sm border border-white/20 whitespace-nowrap">
                            {t}
                        </div>
                    ))}
                </div>

                {/* film icon (top-right) */}
                <div className="absolute top-2.5 right-2.5 z-20 text-white/50 drop-shadow-sm">
                    <IoIosFilm className="w-5 h-5" />
                </div>

                {/* bottom-left overlays (genres and actors) */}
                <div className="absolute bottom-2.5 left-2.5 z-30 flex flex-col gap-1.5 items-start w-full">
                    {genre && genre.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {genre.slice(0, 3).map((g) => (
                                <span key={g} className="bg-black/70 backdrop-blur-md px-1.5 py-0.5 rounded text-[9px] font-medium text-white/90 shadow-sm border border-white/10">
                                    {g}
                                </span>
                            ))}
                        </div>
                    )}
                    {actors && actors.length > 0 && (
                        <div className="w-full overflow-hidden">
                            <CarouselText data={actors} />
                        </div>
                    )}
                </div>

                {/* duration pill */}
                {duration && (
                    <div className="absolute bottom-2.5 right-2.5 z-20 bg-black/70 backdrop-blur-md px-1.5 py-0.5 rounded text-[11px] font-medium text-white/90 shadow-sm border border-white/10">
                        {duration}
                    </div>
                )}

                {/* cover or fallback */}
                {coverUrl ? (
                    <img 
                        src={coverUrl} 
                        alt={title} 
                        className="w-full h-full object-cover" 
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <span className="text-gray-600 text-sm font-medium">No Cover</span>
                    </div>
                )}
            </div>

            {/* details */}
            <div className="p-3 flex flex-col gap-1 flex-none relative">
                {onEdit && (
                    <button 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(); }} 
                        className="absolute right-2 top-2 p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors z-20"
                    >
                        <IoEllipsisHorizontal className="w-4 h-4" />
                    </button>
                )}
                <h2 className="text-[15px] font-semibold text-gray-100 leading-snug truncate pr-6" title={title}>
                    {title}
                </h2>
                {director && (
                    <p className="text-sm text-gray-500 truncate">Directed by {director}</p>
                )}
            </div>
        </div>
    )
}