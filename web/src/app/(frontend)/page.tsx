import type { Metadata } from 'next'
import { EditableProjectsGrid } from './EditableProjectsGrid'
import { queryProjects } from './projects/queries'

export const metadata: Metadata = {
  title: 'Гоньба — жемчужина Вятки',
  description:
    'Места, люди, ремёсла и маршруты Малмыжской земли. Выберите проект и сразу войдите в его жизнь.',
}

// Главная зависит от живого набора проектов и должна приезжать со свежим CSS/контентом.
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const projects = await queryProjects()

  return (
    <main className="world-home">
      <header className="world-home__hero">
        <div className="world-home__river" aria-hidden />
        <div className="world-home__hero-content container">
          <p className="world-home__kicker">Малмыжская земля · на берегу реки Вятки</p>
          <h1 aria-label="Гоньба — жемчужина Вятки">
            <span>Гоньба</span>
            <em>жемчужина Вятки</em>
          </h1>
          <div className="world-home__lead">
            <p>
              Там, где Вятка огибает луга, рядом живут гостевые дома, ремёсла, сады, маршруты и
              люди. Выберите свой берег — и войдите в жизнь проекта.
            </p>
            <div className="world-home__actions">
              <a href="#projects" className="world-home__discover">
                Все проекты ↓
              </a>
            </div>
          </div>
        </div>
      </header>

      <section
        id="projects"
        className="container world-home__projects scroll-mt-6"
        aria-label="Проекты Гоньбы"
      >
        <div className="world-home__projects-heading">
          <p>Все направления · Малмыжский район</p>
          <h2>Выберите свою Гоньбу</h2>
        </div>
        <EditableProjectsGrid initialProjects={projects} centerSlug="gonba" />
      </section>
    </main>
  )
}
