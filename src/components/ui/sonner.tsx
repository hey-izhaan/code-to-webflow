import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
    return (
        <Sonner
            theme="dark"
            className="toaster group"
            toastOptions={{
                classNames: {
                    toast:
                        "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl",
                    description: "group-[.toast]:text-muted-foreground",
                    actionButton:
                        "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
                    cancelButton:
                        "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
                    success: "group-[.toaster]:!bg-emerald-500/10 group-[.toaster]:!border-emerald-500/20 group-[.toaster]:!text-emerald-400",
                    error: "group-[.toaster]:!bg-red-500/10 group-[.toaster]:!border-red-500/20 group-[.toaster]:!text-red-400",
                },
            }}
            {...props}
        />
    )
}

export { Toaster }
