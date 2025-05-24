import { WebsiteClassifier } from "@/components/WebsiteClassifier";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        <WebsiteClassifier />
      </div>
    </div>
  );
}
