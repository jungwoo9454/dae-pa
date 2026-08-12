"use client";

import { useId, useRef, useState } from "react";
import { ImagePlus, LoaderCircle, X } from "lucide-react";

/** app/api/upload/route.ts 의 KINDS 와 같은 값이어야 한다 — R2 키 prefix 로 쓰인다 */
export type UploadKind = "receipts" | "avatars" | "deals" | "chat";

/**
 * 이미지 한 장을 서버로 보내 webp 로 변환·저장하고 공개 URL 을 받는다.
 * 미리보기 UI 없이 파일만 올리고 싶은 화면(채팅)이 이 함수만 따로 쓴다.
 */
export async function uploadImage(file: File, kind: UploadKind): Promise<string> {
  const fd = new FormData();
  fd.append("kind", kind);
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !body.url) throw new Error(body.error ?? "업로드에 실패했어요");
  return body.url;
}

export default function ImageUpload({
  kind,
  value,
  onChange,
  label = "사진 첨부",
  height = 120,
  round = false,
}: {
  kind: UploadKind;
  value?: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  height?: number;
  /** 아바타처럼 원형으로 보여줄지 */
  round?: boolean;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await uploadImage(file, kind));
    } catch (e) {
      alert(e instanceof Error ? e.message : "업로드에 실패했어요");
    } finally {
      setBusy(false);
      // 같은 파일을 다시 골라도 change 가 뜨도록 비운다
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const shape = round ? "rounded-full" : "rounded-[14px]";

  return (
    <div className="flex flex-col gap-1.5">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      {value ? (
        <div className={`relative overflow-hidden border border-[#d8e7d6] ${shape}`} style={{ height, width: round ? height : undefined }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- R2 공개 URL 이라 next/image 도메인 설정 없이 쓴다 */}
          <img src={value} alt="" className="h-full w-full object-cover" />
          <div
            onClick={() => onChange(null)}
            title="사진 지우기"
            className="absolute right-1.5 top-1.5 cursor-pointer rounded-full bg-black/55 p-1 text-white hover:bg-black/75"
          >
            <X aria-hidden className="h-3.5 w-3.5" />
          </div>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className={`flex cursor-pointer items-center justify-center gap-2 border border-dashed border-[#c3dcc4] bg-[#f7fbf6] text-[13px] font-bold text-[#4d6d58] hover:border-[#1f8a4c] hover:text-[#1f8a4c] ${shape}`}
          style={{ height, width: round ? height : undefined }}
        >
          {busy ? (
            <>
              <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" /> 올리는 중…
            </>
          ) : (
            <>
              <ImagePlus aria-hidden className="h-4 w-4" /> {round ? "" : label}
            </>
          )}
        </label>
      )}
    </div>
  );
}
