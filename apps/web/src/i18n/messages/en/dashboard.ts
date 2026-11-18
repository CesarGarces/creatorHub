export const dashboard = {
  greeting: {
    morning: "Good morning, {name} 👋",
    afternoon: "Good afternoon, {name} 👋",
    evening: "Good evening, {name} 👋",
  },
  subtitle: "What will you create today?",
  search: "Search...",
  quickPrompt: {
    placeholder: "Describe what you want to create...",
    ariaLabel: "Describe what you want to create",
    generate: "Generate",
    making: "Making...",
    try: "Try:",
    examples: {
      gamingThumbnail: "Gaming thumbnail",
      youtubeIntro: "YouTube intro script",
      viralTitle: "Viral video title",
    },
  },
  favoriteTools: "Favorite Tools — drag to reorder",
  quickAccess: "Quick Access",
  dragToReorder: "Drag to reorder {name}",
  noToolsTitle: "No tools available",
  noToolsDescription: "Tools will appear here once they are activated.",
  recentActivity: "Recent Activity",
  noActivity: "No activity yet",
  activityMeta_one: "{time} · {count} credit",
  activityMeta_other: "{time} · {count} credits",
  txType: {
    tool: "Tool",
    purchase: "Purchase",
    bonus: "Bonus",
  },
  recommendedAgents: "Recommended Agents",
  /** Dashboard widgets (names and descriptions also used in Settings). */
  widgets: {
    region: "Dashboard widgets",
    quickPrompt: {
      name: "Quick prompt",
      description:
        "Ask the assistant to create something right from your dashboard.",
    },
    todayPlans: {
      name: "Plans for today",
      description:
        "Today's sessions from your Content Planner, with their name and description.",
    },
    favorites: {
      name: "Favorite tools",
      description:
        "Your starred tools in your order, or quick access to the first tools.",
    },
    activity: {
      name: "Recent activity",
      description:
        "Your latest credit movements: tools, purchases and bonuses.",
    },
    recommendations: {
      name: "Recommendations",
      description: "Agents picked to help you grow on social media.",
    },
    assetStats: {
      name: "Likes & views",
      description:
        "Your most liked assets with a preview, and the total likes and views.",
    },
    credits: {
      name: "Credits",
      description:
        "Your balance and plan at a glance, with a shortcut to top up.",
    },
    tips: {
      name: "Pro tip",
      description:
        "A new tip every hour on using Creator Hub and growing your channel.",
    },
    voiceAssistant: {
      name: "Robotina",
      description:
        "Tap the orb and talk with your AI voice assistant, in English, Spanish or Portuguese.",
    },
  },
  todayPlans: {
    open: "Open planner",
    empty: "Nothing planned for today.",
    plan: "Plan a session",
    error: "Couldn't load today's plans.",
    retry: "Try again",
    more_one: "+{count} more session",
    more_other: "+{count} more sessions",
    now: "Now",
    time: "{start} – {end}",
    from: "From {time}",
    until: "Until {time}",
    startsIn: "in {duration}",
    ago: "{duration} ago",
    justEnded: "Just ended",
    minutes: "{minutes} min",
    hours: "{hours} h",
    hoursMinutes: "{hours} h {minutes} min",
  },
  assetStats: {
    open: "View assets",
    totalLikes: "Total likes",
    totalViews: "Total views",
    likes_one: "{count} like",
    likes_other: "{count} likes",
    views_one: "{count} view",
    views_other: "{count} views",
    video: "Video",
    newTab: "(opens in a new tab)",
    noPreview: "No preview",
    untitled: "Untitled",
    empty: "No likes or views yet. Share an asset to start getting them.",
    goToAssets: "Go to my assets",
    error: "Couldn't load your likes and views.",
    retry: "Try again",
  },
  tips: {
    position: "Tip {index} of {total}",
    everyHour: "A new tip every hour.",
    error: "Couldn't load the tips.",
    retry: "Try again",
    categories: {
      dashboard: "Dashboard",
      calendar: "Calendar",
      "ai-planner": "AI planner",
      viral: "Viral videos",
      thumbnails: "Thumbnails",
      scripts: "Scripts",
      assistant: "AI assistant",
      clipper: "Video clipper",
      social: "Social & community",
      assets: "Assets",
      credits: "Credits",
      account: "Account",
    },
  },
  creditsWidget: {
    available_one: "credit available",
    available_other: "credits available",
    plan: "Plan: {plan}",
    low: "Running low — top up to keep creating.",
    buy: "Buy credits",
  },
  /** Rearranging the dashboard (press and hold a widget, or "Customize"). */
  layout: {
    customize: "Customize",
    customizeLabel: "Customize dashboard",
    done: "Done",
    addWidgets: "Add widgets",
    editing: "Drag widgets to rearrange them. Tap − to hide one.",
    hide: "Hide {name}",
    move: "Move {name}",
    hidden: "{name} hidden",
    undo: "Undo",
    saveFailed: "Couldn't save your dashboard. Your last change was undone.",
    emptyTitle: "Your dashboard is empty",
    emptyDescription:
      "Add widgets to bring back your tools, activity and recommendations.",
    dnd: {
      instructions:
        "To pick up a widget, press Space or Enter. Use the arrow keys to move it, then Space or Enter to drop it, or Escape to cancel.",
      picked: "Picked up {name}.",
      over: "{name} is now at position {position} of {total}.",
      dropped: "{name} dropped at position {position} of {total}.",
      cancelled: "Moving cancelled. {name} is back in its place.",
    },
  },
};
