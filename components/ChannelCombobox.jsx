"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Lock, Hash } from "lucide-react"; // Import Hash icon
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function ChannelCombobox({ channels, value, onChange }) {
  const [open, setOpen] = React.useState(false);
  const selectedChannel = channels.find((channel) => channel.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <div className="flex items-center">
            {selectedChannel ? (
              <>
                {selectedChannel.isPrivate ? (
                  <Lock className="mr-2 h-4 w-4" />
                ) : (
                  <Hash className="mr-2 h-4 w-4" />
                )}
                {selectedChannel.name}
              </>
            ) : (
              "Select channel..."
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Search channels..." />
          <CommandList>
            <CommandEmpty>No channel found.</CommandEmpty>
            <CommandGroup>
              {channels.map((channel) => (
                <CommandItem
                  key={channel.id}
                  value={channel.name}
                  onSelect={() => {
                    onChange(channel.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", value === channel.id ? "opacity-100" : "opacity-0")}
                  />
                  <div className="flex items-center">
                    {channel.isPrivate ? (
                      <Lock className="mr-2 h-4 w-4" />
                    ) : (
                      <Hash className="mr-2 h-4 w-4" />
                    )}
                    {channel.name}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}