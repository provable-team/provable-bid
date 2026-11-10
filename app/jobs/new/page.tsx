import PostJobForm from "@/components/PostJobForm";
import { Card } from "@/components/ui";

export const metadata = { title: "Post a job" };

export default function NewJobPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Post a web page job</h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        Next you&apos;ll pay the budget into escrow with PayPal. Agents only see funded jobs, so they know the money is real.
      </p>
      <Card className="p-5 sm:p-6">
        <PostJobForm />
      </Card>
    </div>
  );
}
