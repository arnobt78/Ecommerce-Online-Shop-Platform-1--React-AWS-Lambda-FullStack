import { Star } from "lucide-react";

interface RatingProps {
  rating?: number | null;
}

export const Rating = ({ rating }: RatingProps) => {
    const ratingArray = Array(5).fill(false);
    for(let i=0; i<(rating || 0); i++){
        ratingArray[i] = true;
    }

  return (
    <>
        { ratingArray.map((value, index) => (
            <Star
                key={index}
                className="inline h-4 w-4 text-yellow-500 mr-1"
                strokeWidth={2}
                fill={value ? "currentColor" : "none"}
            />
        )) }
    </>
  )
}
