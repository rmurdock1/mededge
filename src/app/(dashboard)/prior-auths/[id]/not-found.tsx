import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileQuestion, ArrowLeft } from "lucide-react";

export default function PANotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="max-w-md">
        <CardContent className="py-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
            <FileQuestion className="h-6 w-6 text-brand-600" />
          </div>
          <h2 className="text-lg font-semibold">
            Prior authorization not found
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            This PA may have been removed or you may not have access to it.
            Check the URL or go back to the list.
          </p>
          <Link href="/prior-auths" className="mt-6 inline-block">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Back to all PAs
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
