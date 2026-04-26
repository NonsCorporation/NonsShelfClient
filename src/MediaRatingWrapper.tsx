import type { ReactNode } from "react";
import StarsSelector from "./StarsSelector";

type MediaRatingWrapperProps = {
    children: ReactNode;
    rating?: number | null;
    onRatingChange?: (value: number) => void;
    isEditable?: boolean;
};

export default function MediaRatingWrapper({ 
    children, 
    rating = null, 
    onRatingChange, 
    isEditable = true 
}: MediaRatingWrapperProps) {
    return (
        <div className="flex flex-col gap-2 items-center">
            {children}
            <div className="flex justify-center w-full">
                <StarsSelector 
                    initialValue={rating} 
                    onChange={onRatingChange} 
                    isEditable={isEditable} 
                />
            </div>
        </div>
    );
}