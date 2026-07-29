import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

vi.mock("next/image", () => ({
  // The real component rewrites src through /_next/image; these tests assert
  // on the upstream path, so render a bare img with the same props.
  default: ({ src, alt, fill, priority, sizes, ...rest }: any) => <img src={typeof src === "string" ? src : ""} alt={alt} {...rest} />,
}));

import VideoPlayer from "./VideoPlayer";

/**
 * `external_url` is an editor-supplied string that ends up as an iframe `src`,
 * which makes it the one field on a video that can execute. The component
 * answers that with an allow-list — three known hosts plus direct media files
 * — and everything here exists to keep that list honest, because a regression
 * would not look like a broken page. It would look like a working one.
 *
 * The play control is the thing under test as much as the URL: a rejected URL
 * must not merely fail to embed, it must leave no control that claims it can
 * play something. Offering a button that does nothing is how a reader learns
 * to distrust the site.
 */

const play = async (title: string) => {
  await act(async () => screen.getByLabelText(`تشغيل: ${title}`).click());
};

const renderWith = (externalUrl: string, title = "فيديو") =>
  render(<VideoPlayer lang="ar" externalUrl={externalUrl} title={title} />);

describe("VideoPlayer — embed allow-list", () => {
  it("embeds YouTube through the no-cookie host", async () => {
    renderWith("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    await play("فيديو");

    const frame = screen.getByTitle("فيديو");
    expect(frame).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1");
    // The point of the -nocookie host is that the plain one never appears.
    expect(frame.getAttribute("src")).not.toContain("//www.youtube.com");
  });

  it("embeds a youtu.be short link", async () => {
    renderWith("https://youtu.be/abc123");
    await play("فيديو");

    expect(screen.getByTitle("فيديو")).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/abc123?autoplay=1",
    );
  });

  it("embeds Vimeo", async () => {
    renderWith("https://vimeo.com/76979871");
    await play("فيديو");

    expect(screen.getByTitle("فيديو")).toHaveAttribute("src", "https://player.vimeo.com/video/76979871?autoplay=1");
  });

  it.each([
    ["javascript:", "javascript:alert(document.cookie)"],
    ["data: URI", "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="],
    ["a bare unknown host", "https://evil.example/watch?v=abc"],
    // The classic allow-list bypass: the trusted name as a *suffix* of the
    // real host. A `endsWith("youtube.com")` check would embed this.
    ["a suffix-spoofed host", "https://youtube.com.evil.example/watch?v=abc"],
    // ...and as a prefix, which a naive `startsWith`/`includes` would accept.
    ["a prefix-spoofed host", "https://youtube.com.attacker.net/watch?v=abc"],
    // userinfo before the @: the browser connects to evil.example, but a
    // human — and a sloppy regex — reads "youtube.com" first.
    ["userinfo smuggling", "https://www.youtube.com@evil.example/watch?v=abc"],
    ["an unparseable string", "not a url at all"],
    ["an empty string", ""],
    // A page, not a file. Could be a redirect, a paywall or a login screen.
    ["an arbitrary https page", "https://example.com/some/article"],
    // Right host, wrong shape — no video id to embed.
    ["a YouTube URL with no id", "https://www.youtube.com/watch?list=PL123"],
    ["a bare youtu.be with no id", "https://youtu.be/"],
  ])("refuses to embed %s, and offers no control that pretends otherwise", (_label, url) => {
    renderWith(url);

    expect(screen.queryByLabelText("تشغيل: فيديو")).not.toBeInTheDocument();
    expect(screen.getByText("الفيديو غير متاح حالياً")).toBeInTheDocument();
  });

  it("plays a direct media file inline rather than in an iframe", async () => {
    const { container } = renderWith("https://cdn.example.com/clips/report.mp4");
    await play("فيديو");

    // <video>, not <iframe>: no third-party document, nothing to sandbox.
    expect(container.querySelector("video")).toHaveAttribute("src", "https://cdn.example.com/clips/report.mp4");
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("prefers an uploaded file over an external link", async () => {
    const { container } = render(
      <VideoPlayer
        lang="ar"
        src="/media/videos/own.mp4"
        externalUrl="https://www.youtube.com/watch?v=abc123"
        title="فيديو"
      />,
    );
    await play("فيديو");

    // Our own origin wins: no third party is contacted at all.
    expect(container.querySelector("video")).toHaveAttribute("src", "/media/videos/own.mp4");
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("mounts no third-party frame until the reader asks", () => {
    const { container } = renderWith("https://www.youtube.com/watch?v=dQw4w9WgXcQ");

    // Scrolling past a video page must not pull YouTube (and its cookies) in.
    expect(container.querySelector("iframe")).toBeNull();
    expect(screen.getByLabelText("تشغيل: فيديو")).toBeInTheDocument();
  });
});

describe("VideoPlayer — chrome", () => {
  it("keeps the poster visible while unplayable", () => {
    const { container } = render(<VideoPlayer lang="ar" poster="/media/cover.jpg" title="فيديو" />);

    expect(container.querySelector("img")).toHaveAttribute("src", "/media/cover.jpg");
    expect(screen.getByText("الفيديو غير متاح حالياً")).toBeInTheDocument();
  });

  it("shows the exclusive badge and the duration", () => {
    render(<VideoPlayer lang="ar" title="فيديو" isExclusive durationLabel="04:10" />);

    expect(screen.getByText("حصري")).toBeInTheDocument();
    expect(screen.getByText("04:10")).toBeInTheDocument();
  });

  it("suppresses the em-dash the API sends for an unknown duration", () => {
    render(<VideoPlayer lang="ar" title="فيديو" durationLabel="—" />);

    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });

  it("speaks English on the English edition", () => {
    render(<VideoPlayer lang="en" title="Clip" isExclusive />);

    expect(screen.getByText("Exclusive")).toBeInTheDocument();
    expect(screen.getByText("This video is currently unavailable")).toBeInTheDocument();
  });
});
