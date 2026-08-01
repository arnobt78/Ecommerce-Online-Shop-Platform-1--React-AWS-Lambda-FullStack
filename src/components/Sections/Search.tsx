import { useRef } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Search as SearchIcon } from "lucide-react";

interface SearchProps {
  setSearchSection: (value: boolean) => void;
}

export const Search = ({ setSearchSection }: SearchProps) => {
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchSection(false);
    navigate(`/products?q=${searchRef.current?.value ?? ""}`);
  };

  return (
    <div className="mx-auto max-w-screen-xl p-2 my-5">
      <form onSubmit={handleSearch} className="flex items-center">
        <div className="relative w-full">
          <span className="flex absolute inset-y-0 left-0 items-center pl-3 pointer-events-none text-gray-500">
            <SearchIcon className="h-4 w-4" strokeWidth={2} />
          </span>
          <input
            ref={searchRef}
            name="search"
            type="text"
            id="simple-search"
            className="bg-gray-50 border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 p-2.5  dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
            placeholder="Search"
            autoComplete="off"
            required={false}
          />
        </div>
        <button
          type="submit"
          aria-label="Search"
          className="flex items-center justify-center py-2.5 px-3 ml-2 text-sm font-medium text-white bg-blue-700 rounded-lg border border-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
        >
          <SearchIcon className="h-4 w-4" strokeWidth={2} />
        </button>
      </form>
    </div>
  );
};
