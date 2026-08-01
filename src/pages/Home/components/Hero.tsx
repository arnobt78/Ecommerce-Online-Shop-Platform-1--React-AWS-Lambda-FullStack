import { Link } from "react-router-dom";
import { HeroRotatingBackground } from "./HeroRotatingBackground";

export const Hero = () => {
  return (
    <section className="flex flex-col lg:flex-row dark:text-slate-100 items-center">
      <div className="text my-5">
        <h1 className="text-5xl font-medium">The Ultimate eBook Store</h1>
        <p className="text-2xl my-7 px-1 dark:text-slate-300">
          CodeBook is the world's most popular and authoritative source for
          computer science ebooks. Find ratings and access to the newest books
          digitally.
        </p>
        <Link
          to="/products"
          type="button"
          className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-base px-5 py-2.5 mr-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800"
        >
          Explore eBooks
        </Link>
      </div>
      <div
        className="visual my-5 lg:max-w-xl w-full h-64 sm:h-80 lg:h-96"
        role="img"
        aria-label="CodeBook Hero Section"
      >
        <HeroRotatingBackground className="shadow-lg" />
      </div>
    </section>
  );
};
