import { useEffect } from "react";

export const useTitle = (title: string): null => {
  useEffect(() => {
    document.title = `${title} - CodeBook`;
  }, [title]);

  return null;
};
