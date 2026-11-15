import {
  Accessibility,
  Activity,
  ArrowRight,
  Backpack,
  Bell,
  BookOpen,
  Bot,
  Box,
  Brush,
  Calendar,
  Camera,
  ChefHat,
  Circle,
  CircleDot,
  Code,
  Compass,
  Cpu,
  Crown,
  Dice5,
  Dog,
  Dumbbell,
  Flower2,
  Footprints,
  Gamepad2,
  GraduationCap,
  Hammer,
  Hand,
  HandHeart,
  Heart,
  Landmark,
  Languages,
  LayoutGrid,
  Leaf,
  Map,
  MessageCircle,
  Mountain,
  Music,
  Palette,
  PawPrint,
  PersonStanding,
  Puzzle,
  School,
  Scissors,
  Shapes,
  Shield,
  Sigma,
  Sparkles,
  Sprout,
  Tent,
  Theater,
  Toolbox,
  Truck,
  User,
  Users,
  Volleyball,
  Waves,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * Имена иконок приходят из `categories.icon` (database/init.sql). Канон §7
 * использует короткие смысловые имена (`run`, `book`, `paw`), витрина — имена
 * Lucide (`dumbbell`, `book-open`, `paw-print`). Оба словаря живут здесь и
 * обязаны вести к одной и той же картинке, иначе часть категорий падает в
 * заглушку и выглядит одинаково.
 *
 * Экспортируется, чтобы тест `Icon.test.ts` мог сверить карту со значениями
 * колонки `icon` из `database/init.sql` и с моками `src/lib/data.ts`.
 */
export const iconMap: Record<string, LucideIcon> = {
  accessibility: Accessibility,
  activity: Activity,
  "arrow-right": ArrowRight,
  backpack: Backpack,
  ball: Circle,
  basketball: CircleDot,
  bell: Bell,
  book: BookOpen,
  "book-open": BookOpen,
  bot: Bot,
  box: Box,
  brush: Brush,
  calendar: Calendar,
  camera: Camera,
  chef: ChefHat,
  "chef-hat": ChefHat,
  chess: Crown,
  circle: Circle,
  code: Code,
  compass: Compass,
  cpu: Cpu,
  crown: Crown,
  cube: Box,
  dance: PersonStanding,
  dice: Dice5,
  dog: Dog,
  dots: LayoutGrid,
  dumbbell: Dumbbell,
  fist: Shield,
  flower: Flower2,
  footprints: Footprints,
  gamepad: Gamepad2,
  globe: Languages,
  "graduation-cap": GraduationCap,
  gym: Accessibility,
  hammer: Hammer,
  hand: Hand,
  "hand-heart": HandHeart,
  hands: HandHeart,
  heart: Heart,
  horse: PawPrint,
  landmark: Landmark,
  languages: Languages,
  "layout-grid": LayoutGrid,
  leaf: Leaf,
  logic: Puzzle,
  map: Map,
  "message-circle": MessageCircle,
  mountain: Mountain,
  music: Music,
  nail: Hand,
  palette: Palette,
  paw: PawPrint,
  "paw-print": PawPrint,
  "person-standing": PersonStanding,
  puzzle: Puzzle,
  robot: Bot,
  run: Footprints,
  saw: Hammer,
  school: School,
  scissors: Scissors,
  shield: Shield,
  sigma: Sigma,
  sparkles: Sparkles,
  speech: MessageCircle,
  sprout: Sprout,
  tent: Tent,
  theater: Theater,
  tool: Toolbox,
  toolbox: Toolbox,
  truck: Truck,
  user: User,
  users: Users,
  volleyball: Volleyball,
  water: Waves,
  waves: Waves,
  wrench: Wrench,
  yarn: Scissors,
  yoga: Activity,
};

export function resolveIconName(name?: string): string {
  if (!name) return "shapes";
  if (name in iconMap) return name;
  const lower = name.toLowerCase().trim();
  if (lower in iconMap) return lower;

  if (
    lower.includes("творч") ||
    lower.includes("искусств") ||
    lower.includes("арт") ||
    lower.includes("art") ||
    lower.includes("creative")
  ) {
    return "palette";
  }
  if (
    lower.includes("спорт") ||
    lower.includes("физич") ||
    lower.includes("атлетик") ||
    lower.includes("sport") ||
    lower.includes("fitness")
  ) {
    return "dumbbell";
  }
  if (
    lower.includes("технолог") ||
    lower.includes("игры") ||
    lower.includes("программ") ||
    lower.includes("tech") ||
    lower.includes("game")
  ) {
    return "cpu";
  }
  if (
    lower.includes("обучен") ||
    lower.includes("дет") ||
    lower.includes("школ") ||
    lower.includes("образов") ||
    lower.includes("educat") ||
    lower.includes("learn")
  ) {
    return "graduation-cap";
  }
  if (
    lower.includes("животн") ||
    lower.includes("природ") ||
    lower.includes("питом") ||
    lower.includes("nature") ||
    lower.includes("animal")
  ) {
    return "paw-print";
  }
  if (
    lower.includes("путешеств") ||
    lower.includes("туризм") ||
    lower.includes("поход") ||
    lower.includes("отдых") ||
    lower.includes("travel") ||
    lower.includes("outdoor")
  ) {
    return "mountain";
  }
  if (
    lower.includes("практич") ||
    lower.includes("навык") ||
    lower.includes("ремесл") ||
    lower.includes("мастер") ||
    lower.includes("skill") ||
    lower.includes("practical")
  ) {
    return "wrench";
  }
  if (
    lower.includes("социальн") ||
    lower.includes("сообществ") ||
    lower.includes("волонтер") ||
    lower.includes("social")
  ) {
    return "users";
  }
  if (lower.includes("друг") || lower.includes("other") || lower.includes("grid")) {
    return "layout-grid";
  }
  if (lower.includes("услуг") || lower.includes("service") || lower.includes("sparkl")) {
    return "sparkles";
  }
  return "shapes";
}

export function CategoryIcon({
  name,
  size = 24,
  className,
  strokeWidth = 1.7,
}: {
  name?: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  const iconKey = resolveIconName(name);
  const Icon = iconMap[iconKey] ?? Shapes;
  return <Icon size={size} className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
}
