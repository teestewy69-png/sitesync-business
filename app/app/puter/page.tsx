import PuterChat from "@/components/factory/PuterChat";
import FactoryShell from "@/components/factory/Shell";

export const dynamic = "force-dynamic";

export default function PuterPage() {
  return (
    <FactoryShell title="Puter">
      <p className="max-w-3xl text-base text-zinc-300">
        Browser call to openai/gpt-oss-120b through Puter. Puter may ask you to sign in. This does not write the city
        pages.
      </p>
      <PuterChat />
    </FactoryShell>
  );
}
