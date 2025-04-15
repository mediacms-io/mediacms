import * as Tabs from '@radix-ui/react-tabs';

export function CustomTabs({ children, defaultValue }: { children: React.ReactNode, defaultValue: string }) {
  return (
    <Tabs.Root defaultValue={defaultValue}>
      {children}
    </Tabs.Root>
  );
}

export function TabsList({ children }: { children: React.ReactNode }) {
  return (
    <Tabs.List className="flex gap-4 border-b">
      {children}
    </Tabs.List>
  );
}

export function TabsTrigger({ children, value }: { children: React.ReactNode, value: string }) {
  return (
    <Tabs.Trigger 
      value={value}
      className="px-4 py-2 hover:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary"
    >
      {children}
    </Tabs.Trigger>
  );
}

export function TabsContent({ children, value }: { children: React.ReactNode, value: string }) {
  return (
    <Tabs.Content value={value}>
      {children}
    </Tabs.Content>
  );
}
