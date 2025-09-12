import { FC } from "react";
import { Content } from "@prismicio/client";
import { SliceComponentProps, PrismicLink } from "@prismicio/react";
import { PrismicText } from "@prismicio/react";

/**
 * Props for `DependencyCta`.
 */
export type DependencyCtaProps =
  SliceComponentProps<Content.DependencyCtaSlice>;

/**
 * Component for "DependencyCta" Slices.
 */
const DependencyCta: FC<DependencyCtaProps> = ({ slice }) => {
  return (
    <section
      data-slice-type={slice.slice_type}
      data-slice-variation={slice.variation}
      className="my-12 py-8 px-6 bg-slate-800/50 border border-slate-700 rounded-lg"
    >
      <div className="max-w-2xl mx-auto text-center">
        <div className="flex items-center justify-center mb-4">
          {slice.primary.show_icon && (
            <svg
              className="w-6 h-6 mr-3 text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          )}

          <h3 className="text-xl font-semibold text-white">
            {slice.primary.heading}
          </h3>
        </div>

        <p className="text-slate-300 mb-6 text-base leading-relaxed">
          field={slice.primary.subtext}
        </p>

        <PrismicLink
          field={slice.primary.button_link}
          className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800"
        >
          {slice.primary.button_text}
          <svg
            className="w-4 h-4 ml-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
        </PrismicLink>
      </div>
    </section>
  );
};

export default DependencyCta;