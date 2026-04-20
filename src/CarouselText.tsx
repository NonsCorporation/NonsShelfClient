export default function CarouselText({ data }: { data: string[] }) {
    // prevents rendering if the array is empty or undefined
    if (!data || data.length === 0) return null;

    return (
        <div className="w-full flex items-center">
            <div className="flex w-full overflow-x-auto gap-2 py-2">
                {data.map((text, i) => (
                    <span 
                        key={i} 
                        className="shrink-0 whitespace-nowrap bg-nonscontainer2bg px-3 py-1 rounded-full text-xs text-gray-400 opacity-80"
                    >
                        {text}
                    </span>
                ))}
            </div>
        </div>
    );
}