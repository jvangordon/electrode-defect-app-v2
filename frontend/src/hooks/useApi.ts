import { useState, useEffect, useCallback, useRef } from 'react';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useApi<T>(fetcher: () => Promise<T>, deps: any[] = []) {
  const [state, setState] = useState<UseApiState<T>>({ data: null, loading: true, error: null });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refetch = useCallback(() => {
    setState(s => ({ ...s, loading: true, error: null }));
    fetcherRef.current()
      .then(data => setState({ data, loading: false, error: null }))
      .catch(err => setState({ data: null, loading: false, error: err.message }));
  }, []);

  useEffect(() => {
    refetch();
  }, [...deps, refetch]);

  return { ...state, refetch };
}
