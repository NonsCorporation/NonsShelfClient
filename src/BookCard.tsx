import { IoBookSharp, IoEllipsisHorizontal } from "react-icons/io5";

type BookCardProps = {
    title: string
    author: string
    coverUrl?: string
    tags?: string[]
    genre?: string[]
    onEdit?: () => void
}

export default function BookCard({ title, author, coverUrl, tags, genre, onEdit }: BookCardProps) {
    return (
        <div className="w-48 h-[340px] bg-nonscontainerbg rounded-sm group overflow-hidden cursor-pointer flex flex-col border border-white/5 hover:bg-white/5 hover:border-white/10 transition-all duration-300">
            {/* container for image and absolute elements */}
            <div className="relative w-full aspect-[2/3] overflow-hidden rounded-lg bg-gray-100">                <div className="absolute inset-0 transition-colors duration-300 group-hover:bg-black/10 z-10" />
                
                {/* icon with heavy shadow for visibility */}
                <div className="absolute top-2.5 right-2.5 z-20 text-white/50 drop-shadow-sm">
                    <IoBookSharp className="w-5 h-5" />
                </div>
                
                {/* tags / status pills (top-left) */}
                {tags && tags.length > 0 && (
                    <div className="absolute top-2.5 left-2.5 z-30 flex flex-col gap-1 items-start">
                        {tags.map((t) => (
                            <span key={t} className="bg-nonsprimary/90 text-white px-1.5 py-0.5 rounded text-[10px] font-semibold backdrop-blur-md shadow-sm border border-white/20 whitespace-nowrap">
                                {t}
                            </span>
                        ))}
                    </div>
                )}
                
                {/* genre pills (bottom-left overlay) */}
                <div className="absolute bottom-2.5 left-2.5 z-30 flex flex-col gap-1.5 items-start max-w-[70%]">
                    <div className="flex flex-wrap gap-1">
                        {genre && genre.length > 0 && genre.slice(0, 3).map((g) => (
                            <span key={g} className="bg-black/70 backdrop-blur-md px-1.5 py-0.5 rounded text-[9px] font-medium text-white/90 shadow-sm border border-white/10">
                                {g}
                            </span>
                        ))}
                    </div>
                </div>

                {/* renders the cover image or fallback */}
                {coverUrl ? (
                    <img src={coverUrl} alt={title} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full bg-gray-300 flex items-center justify-center">
                        <span className="text-gray-500">No Cover</span>
                    </div>
                )}
            </div>
            
            {/* book title and author details */}
            <div className="p-3 flex flex-col gap-1 flex-none relative">
                {onEdit && (
                    <button 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(); }} 
                        className="absolute right-2 top-2 p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors z-20"
                    >
                        <IoEllipsisHorizontal className="w-4 h-4" />
                    </button>
                )}
                <h2 className="text-md font-bold text-gray-100 leading-snug truncate pr-6" title={title}>{title}</h2>
                <p className="text-sm text-gray-500 truncate">{author}</p>
            </div>
        </div>
    )
}