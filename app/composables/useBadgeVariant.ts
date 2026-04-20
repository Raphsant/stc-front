export function useBadgeVariant() {
  const colorMode = useColorMode()
  return computed<'subtle' | 'solid'>(() => colorMode.value === 'dark' ? 'subtle' : 'soft')
}
