import { redirect } from "next/navigation";

export default function LegacySubmitPhotoPage() {
  redirect("/requests/photo");
}
