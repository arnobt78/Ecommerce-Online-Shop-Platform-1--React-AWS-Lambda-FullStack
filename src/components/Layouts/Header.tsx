import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Settings, Search as SearchIcon, ShoppingCart, CircleUserRound } from "lucide-react";
import { Search } from "../Sections/Search";
import { DropdownLoggedOut, DropdownLoggedIn } from "../index";
import { UserAvatar } from "../ui";
import { useCart } from "../../context";

const Logo = "/logo.png";

export const Header = () => {
  const { cartList } = useCart();
  const [darkMode, setDarkMode] = useState<boolean>(
    JSON.parse(localStorage.getItem("darkMode") || "false") || false,
  );
  const [searchSection, setSearchSection] = useState(false);
  const [dropdown, setDropdown] = useState(false);
  const token = JSON.parse(sessionStorage.getItem("token") || "null");
  const cachedUserId =
    token && JSON.parse(sessionStorage.getItem("cbid") || "null");
  const cachedUserImage = token && sessionStorage.getItem("userImage");

  // Calculate total quantity (sum of all item quantities)
  const totalCartQuantity = useMemo(() => {
    return cartList.reduce((sum, item) => sum + (item.quantity || 1), 0);
  }, [cartList]);

  useEffect(() => {
    localStorage.setItem("darkMode", JSON.stringify(darkMode));

    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  return (
    <header>
      <nav className="bg-white dark:bg-gray-900">
        <div className="border-b border-slate-200 dark:border-b-0 flex flex-wrap justify-between items-center mx-auto max-w-9xl px-2 sm:px-4 xl:px-8 py-3">
          <Link to="/" className="flex items-center">
            <img src={Logo} className="mr-1 sm:mr-3 h-10" alt="CodeBook Logo" />
            <span className="self-center text-xl sm:text-2xl font-medium whitespace-nowrap dark:text-white">
              CodeBook
            </span>
          </Link>
          <div className="flex items-center relative">
            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              aria-label="Toggle dark mode"
              className="cursor-pointer text-gray-700 dark:text-white mr-3 sm:mr-5"
            >
              <Settings className="h-5 w-5" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => setSearchSection(!searchSection)}
              aria-label="Toggle search"
              className="cursor-pointer text-gray-700 dark:text-white mr-3 sm:mr-5"
            >
              <SearchIcon className="h-5 w-5" strokeWidth={2} />
            </button>
            <Link
              to="/cart"
              className="relative text-gray-700 dark:text-white mr-3 sm:mr-5"
            >
              <ShoppingCart className="h-6 w-6" strokeWidth={2} fill="currentColor" />
              <span className="text-white text-sm absolute -top-1 left-3.5 bg-rose-500 px-1 rounded-full">
                {totalCartQuantity}
              </span>
            </Link>
            {token ? (
              <button
                type="button"
                onClick={() => setDropdown(!dropdown)}
                className="cursor-pointer"
                aria-label="Account menu"
                data-user-avatar-trigger
              >
                <UserAvatar
                  image={cachedUserImage}
                  userId={cachedUserId}
                  size={28}
                />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setDropdown(!dropdown)}
                aria-label="Account menu"
                className="cursor-pointer text-gray-700 dark:text-white"
                data-user-avatar-trigger
              >
                <CircleUserRound className="h-7 w-7" strokeWidth={2} />
              </button>
            )}
            {dropdown &&
              (token ? (
                <DropdownLoggedIn setDropdown={setDropdown} />
              ) : (
                <DropdownLoggedOut setDropdown={setDropdown} />
              ))}
          </div>
        </div>
      </nav>
      {searchSection && <Search setSearchSection={setSearchSection} />}
    </header>
  );
};
