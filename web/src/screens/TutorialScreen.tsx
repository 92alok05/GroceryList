import { useRef, useState } from 'react'
import { Icon, type IconName } from '../components/icons'

interface Page {
  icon: IconName
  color: string
  title: string
  description: string
}

const PAGES: Page[] = [
  { icon: 'cart', color: '#34c759', title: 'Welcome to Grocery List', description: 'Keep track of everything your household needs to buy, organized by store, with automatic reminders for recurring items.' },
  { icon: 'plus', color: '#007aff', title: 'Add Items Your Way', description: 'For every item, set the store you recommend buying it from, how much to get, and how often it needs to be repurchased — from One Time to Daily, Weekly, Monthly, or a Custom cadence.' },
  { icon: 'extend', color: '#ff9500', title: 'Needed, Due Soon, Bought', description: 'Every item shows one of three statuses: an empty circle (Needed), an orange hourglass (Due Soon — almost time to restock), or a green checkmark (Bought). Tap the icon to check an item off. Swipe left on a Due Soon item to Extend it if you need more time.' },
  { icon: 'store', color: '#af52de', title: 'Shop by Store', description: 'Switch to Store Mode to see a focused checklist for just one store at a time — perfect for checking things off as you walk the aisles.' },
  { icon: 'search', color: '#5856d6', title: 'Search & Stay Organized', description: 'Use the search bar to quickly find any item or store. Your list is automatically sorted with what you still need at the top, Due Soon items next, and Bought items at the bottom.' },
  { icon: 'people', color: '#ff2d55', title: 'Share With Family', description: 'Connect a Google Sheet from the Settings tab so everyone in your family can see and update the same grocery list from their own iPhone.' },
  { icon: 'seal', color: '#34c759', title: "You're All Set!", description: "That's everything you need to know. Tap Get Started to start building your grocery list." },
]

/** One-time, skippable onboarding tutorial (text copied verbatim from the iOS app). */
export function TutorialScreen({ onFinish }: { onFinish: () => void }) {
  const [page, setPage] = useState(0)
  const pager = useRef<HTMLDivElement>(null)
  const last = page === PAGES.length - 1

  const goTo = (index: number) => {
    const el = pager.current
    if (el) el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' })
    setPage(index)
  }

  return (
    <div className="tutorial" role="dialog" aria-modal="true" aria-label="Tutorial">
      <div className="tutorial-top">
        {!last && <button className="text-button" onClick={onFinish}>Skip</button>}
      </div>
      <div
        className="pager"
        ref={pager}
        onScroll={(e) => {
          const el = e.currentTarget
          setPage(Math.round(el.scrollLeft / el.clientWidth))
        }}
      >
        {PAGES.map((p) => (
          <div className="pager-page" key={p.title}>
            <div style={{ color: p.color }}><Icon name={p.icon} size={100} /></div>
            <h2>{p.title}</h2>
            <p>{p.description}</p>
          </div>
        ))}
      </div>
      <div className="dots" aria-hidden="true">
        {PAGES.map((p, i) => <span key={p.title} className={i === page ? 'dot active' : 'dot'} />)}
      </div>
      <button className="primary-button" onClick={() => (last ? onFinish() : goTo(page + 1))}>
        {last ? 'Get Started' : 'Next'}
      </button>
    </div>
  )
}
