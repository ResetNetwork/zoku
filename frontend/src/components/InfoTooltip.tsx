interface InfoTooltipProps {
  text: string
}

export default function InfoTooltip({ text }: InfoTooltipProps) {
  return (
    <span
      className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-400 dark:bg-gray-600 text-white text-xs cursor-help ml-2"
      title={text}
    >
      ⓘ
    </span>
  )
}
