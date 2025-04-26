import { Button } from "@/components/ui/button"

interface ExamplePromptsProps {
  onPromptSelect: (prompt: string) => void
}

// Updated example prompts for general fitness (in Dutch)
const EXAMPLE_PROMPTS = [
  {
    title: "Kun je een persoonlijk trainingsplan voor me maken?",
  },
  {
    title: "Hoe voer ik een squat correct uit?",
  },
  {
    title: "Wat zijn goede oefeningen voor buikspieren?",
  },
  {
    title: "Geef me algemene voedingstips voor spieropbouw.",
  },
]

export function ExamplePrompts({ onPromptSelect }: ExamplePromptsProps) {
  return (
    <div className="flex flex-wrap justify-center gap-2 mb-4">
      {EXAMPLE_PROMPTS.map((prompt, i) => (
        <Button 
          key={i}
          variant="outline"
          className="rounded-full border-foreground/50 text-foreground/80 hover:bg-secondary/10 hover:text-secondary-foreground focus-visible:ring-ring focus-visible:ring-offset-1 h-auto px-4 py-2 text-sm whitespace-normal text-center transition-colors duration-150"
          onClick={() => onPromptSelect(prompt.title)}
        >
          {prompt.title}
        </Button>
      ))}
    </div>
  )
}

