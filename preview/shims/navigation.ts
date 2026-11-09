import { hrefFor, usePath } from "../router";

/** Stand-in for next/navigation in the preview build. */
export const usePathname = usePath;
export const useRouter = () => ({
  push: (path: string) => {
    location.hash = hrefFor(path).slice(1);
  },
  replace: (path: string) => {
    location.hash = hrefFor(path).slice(1);
  },
  back: () => history.back(),
});
