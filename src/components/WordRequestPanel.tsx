import { WordRequest } from "@/lib/gameTypes";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

interface WordRequestPanelProps {
  requests: WordRequest[];
  onApprove: (request: WordRequest) => void;
  onReject: (request: WordRequest) => void;
}

export default function WordRequestPanel({ requests, onApprove, onReject }: WordRequestPanelProps) {
  // Deduplicate: group by word, show only one per unique word
  const uniqueRequests = requests.reduce<WordRequest[]>((acc, req) => {
    if (!acc.find(r => r.word === req.word && r.called_word === req.called_word)) {
      acc.push(req);
    }
    return acc;
  }, []);

  if (uniqueRequests.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="font-bold text-sm mb-3 text-primary">📋 단어 인정 요청</h3>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {uniqueRequests.map((req) => (
          <div key={req.id} className="flex items-center gap-2 bg-muted/50 rounded-lg p-2 text-sm">
            <div className="flex-1 min-w-0">
              <span className="font-medium">{req.requester_name}</span>
              <span className="text-muted-foreground mx-1">:</span>
              <span className="text-primary font-bold">"{req.word}"</span>
              <span className="text-muted-foreground mx-1">≈</span>
              <span className="text-secondary-foreground">"{req.called_word}"</span>
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" className="h-7 w-7 text-primary hover:bg-primary/10" onClick={() => onApprove(req)}>
                <Check className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => onReject(req)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
