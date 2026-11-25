import { getT } from "@/lib/i18n/server";
import { ChatClient } from "./ChatClient";

export const metadata = { title: "Ask SevaSutra" };

export default async function ChatPage() {
  const { lang, t } = await getT();
  return (
    <div className="max-w-3xl space-y-3">
      <h1 className="text-2xl font-bold">{t("nav.chat")}</h1>
      <ChatClient lang={lang} llmEnabled={!!process.env.GROQ_API_KEY} />
    </div>
  );
}
