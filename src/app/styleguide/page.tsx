import type { Metadata } from "next";
import { SmoothScroll } from "@/components/smooth-scroll";
import { StyleguideHeader, Toc } from "./chrome";
import {
  ColorSection,
  ComponentsSection,
  CursorSection,
  IconSection,
  MotionSection,
  PrinciplesSection,
  ShapeSection,
  SpacingSection,
  StatesSection,
  TaskPatternsSection,
  TypeSection,
  VoiceSection,
} from "./sections";

export const metadata: Metadata = { title: "Style guide" };

const SECTIONS = [
  ["principles", "Principles"],
  ["color", "Color"],
  ["type", "Typography"],
  ["spacing", "Spacing & layout"],
  ["shape", "Shape & elevation"],
  ["icons", "Iconography"],
  ["components", "Components"],
  ["tasks", "Task patterns"],
  ["states", "States"],
  ["motion", "Motion"],
  ["cursor", "Cursor"],
  ["voice", "Voice"],
] as const;

export default function StyleguidePage() {
  return (
    <>
      <SmoothScroll />
      <StyleguideHeader />
      <div className="mx-auto grid max-w-6xl gap-x-16 px-4 sm:px-8 lg:grid-cols-[180px_minmax(0,1fr)]">
        <Toc sections={SECTIONS} />
        <main id="main" className="min-w-0 pb-32">
          <div className="border-b border-line pt-12 pb-10 sm:pt-20 sm:pb-14">
            <p className="font-mono text-2xs tracking-wider text-ink-3 uppercase">Margin · Design system · v0.1</p>
            <h1 className="mt-4 max-w-[16ch] font-display text-4xl font-normal text-ink sm:text-5xl">
              A quiet page, a <em className="text-accent">clear</em> next step.
            </h1>
            <p className="mt-5 max-w-[56ch] text-base text-ink-2">
              Every screen in Margin is built only from what&rsquo;s on this page. If something you need isn&rsquo;t here,
              add it here first, then use it.
            </p>
          </div>
          <PrinciplesSection n={1} />
          <ColorSection n={2} />
          <TypeSection n={3} />
          <SpacingSection n={4} />
          <ShapeSection n={5} />
          <IconSection n={6} />
          <ComponentsSection n={7} />
          <TaskPatternsSection n={8} />
          <StatesSection n={9} />
          <MotionSection n={10} />
          <CursorSection n={11} />
          <VoiceSection n={12} />
        </main>
      </div>
    </>
  );
}
