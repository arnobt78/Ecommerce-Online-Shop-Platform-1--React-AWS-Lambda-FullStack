export const Testimonials = () => {
  return (
    <section className="my-20">
      <h1 className="text-2xl text-center font-medium dark:text-slate-100 mb-5 underline underline-offset-8">
        Student About CodeBook
      </h1>
      <div className="grid mb-8 rounded-lg border border-gray-200 shadow-sm dark:border-gray-700 md:mb-12 md:grid-cols-2">
        <figure className="flex flex-col justify-center items-center p-8 text-center bg-white rounded-t-lg border-b border-gray-200 md:rounded-t-none md:rounded-tl-lg md:border-r dark:bg-gray-800 dark:border-gray-700">
          <blockquote className="mx-auto mb-4 max-w-2xl text-gray-500 lg:mb-8 dark:text-gray-400">
            <h3 className="text-lg font-medium text-gray-700 dark:text-white">
              Finally, a React book that ships real projects
            </h3>
            <p className="my-4 font-light">
              "Basics To Advanced In React" got me from barely knowing hooks to
              shipping a production dashboard in three weeks. The chapter
              projects are the reason it clicked for me."
            </p>
          </blockquote>
          <figcaption className="flex justify-center items-center space-x-3">
            <img
              className="w-9 h-9 rounded-full"
              src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=120&q=50"
              alt="user"
            />
            <div className="space-y-0.5 font-medium dark:text-white text-left">
              <div>Hannah Whitfield</div>
              <div className="text-sm font-light text-gray-500 dark:text-gray-400">
                Frontend Engineer, bootcamp graduate
              </div>
            </div>
          </figcaption>
        </figure>
        <figure className="flex flex-col justify-center items-center p-8 text-center bg-white rounded-tr-lg border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <blockquote className="mx-auto mb-4 max-w-2xl text-gray-500 lg:mb-8 dark:text-gray-400">
            <h3 className="text-lg font-medium text-gray-700 dark:text-white">
              The backend reference I keep coming back to
            </h3>
            <p className="my-4 font-light">
              "The Complete Guide to Backend Development" is the one ebook on
              my shelf I still reopen mid-project — the caching and rate
              limiting chapters alone paid for it."
            </p>
          </blockquote>
          <figcaption className="flex justify-center items-center space-x-3">
            <img
              className="w-9 h-9 rounded-full"
              src="https://images.unsplash.com/photo-1525085475165-c6808cdb005e?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=120&q=50"
              alt="user"
            />
            <div className="space-y-0.5 font-medium dark:text-white text-left">
              <div>Marcus Odei</div>
              <div className="text-sm font-light text-gray-500 dark:text-gray-400">
                Backend Engineer at a Series A startup
              </div>
            </div>
          </figcaption>
        </figure>
        <figure className="flex flex-col justify-center items-center p-8 text-center bg-white rounded-bl-lg border-b border-gray-200 md:border-b-0 md:border-r dark:bg-gray-800 dark:border-gray-700">
          <blockquote className="mx-auto mb-4 max-w-2xl text-gray-500 lg:mb-8 dark:text-gray-400">
            <h3 className="text-lg font-medium text-gray-700 dark:text-white">
              Git finally makes sense
            </h3>
            <p className="my-4 font-light">
              "Mastering Git and GitHub" untangled rebase and reflog for me in
              an afternoon — I stopped being scared of my own terminal history
              after chapter three."
            </p>
          </blockquote>
          <figcaption className="flex justify-center items-center space-x-3">
            <img
              className="w-9 h-9 rounded-full"
              src="https://images.unsplash.com/photo-1633332755192-727a05c4013d?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=120&q=60"
              alt="user"
            />
            <div className="space-y-0.5 font-medium dark:text-white text-left">
              <div>Diego Fuentes</div>
              <div className="text-sm font-light text-gray-500 dark:text-gray-400">
                Computer Science student
              </div>
            </div>
          </figcaption>
        </figure>
        <figure className="flex flex-col justify-center items-center p-8 text-center bg-white rounded-b-lg border-gray-200 md:rounded-br-lg dark:bg-gray-800 dark:border-gray-700">
          <blockquote className="mx-auto mb-4 max-w-2xl text-gray-500 lg:mb-8 dark:text-gray-400">
            <h3 className="text-lg font-medium text-gray-700 dark:text-white">
              Interview-ready in six weeks
            </h3>
            <p className="my-4 font-light">
              "JavaScript Basics To Advance With Shubham" covers the closures
              and event-loop questions that actually come up in interviews —
              worked through every exercise before my last two onsites."
            </p>
          </blockquote>
          <figcaption className="flex justify-center items-center space-x-3">
            <img
              className="w-9 h-9 rounded-full"
              src="https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=120&q=60"
              alt="user"
            />
            <div className="space-y-0.5 font-medium dark:text-white text-left">
              <div>Priyanka Desai</div>
              <div className="text-sm font-light text-gray-500 dark:text-gray-400">
                Junior Developer, career switcher
              </div>
            </div>
          </figcaption>
        </figure>
      </div>
    </section>
  );
};
