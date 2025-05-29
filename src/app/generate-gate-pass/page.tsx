import OutgoingForm from '@/components/inventory/OutgoingForm';
import InventoryHistorySummarizer from '@/components/gatepass/InventoryHistorySummarizer';
import { Separator } from '@/components/ui/separator';

export default function GenerateGatePassPage() {
  return (
    <div className="container mx-auto p-4 md:p-8 min-h-screen">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-primary tracking-tight">Gate Pass Generator</h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Efficiently create and manage outgoing item gate passes.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <OutgoingForm />
        </div>
        <div className="lg:col-span-1">
          <InventoryHistorySummarizer />
        </div>
      </div>
       <footer className="mt-12 pt-8 border-t text-center text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Stockflow. All rights reserved.</p>
      </footer>
    </div>
  );
}
