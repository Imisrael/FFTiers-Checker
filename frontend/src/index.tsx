import ReactDOM from 'react-dom/client'
import {
    QueryClient,
    QueryClientProvider,
    useQuery,
} from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

const queryClient = new QueryClient()

export default function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <ReactQueryDevtools />
            <Example />
        </QueryClientProvider>
    )
}

function Example() {
    const { isPending, error, data, isFetching } = useQuery({
        queryKey: ['tiers'],
        queryFn: async () => {
            const response = await fetch(
                '/json',
            )
            return await response.json()
        },
    })

    if (isPending) return 'Loading...'

    if (error) return 'An error has occurred: ' + error.message

    const Qb = data.QB.Standard.map(tier =>
        <li>{tier}</li>
    )

    console.log(data)

    return (
        <div>
            <ul>
                {Qb}
            </ul>
        </div>
    )
}

const rootElement = document.getElementById('root') as HTMLElement
ReactDOM.createRoot(rootElement).render(<App />)