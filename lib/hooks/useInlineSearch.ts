import { useState } from "react";

export interface UseInlineSearchResult {
  searchText: string;
  searchExpanded: boolean;
  setSearchExpanded: (expanded: boolean) => void;
  setSearchText: (text: string) => void;
}

export function useInlineSearch(
  initialExpanded = false,
): UseInlineSearchResult {
  const [searchText, setSearchText] = useState("");
  const [searchExpanded, setSearchExpanded] = useState(initialExpanded);

  return {
    searchText,
    searchExpanded,
    setSearchExpanded,
    setSearchText,
  };
}
