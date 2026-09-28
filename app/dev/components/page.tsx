import { notFound } from 'next/navigation'
import { ChevronRight, Search, ShoppingBag } from 'lucide-react'
import { Accordion, AccordionItem } from '@/components/ui/accordion'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Divider } from '@/components/ui/divider'
import { GeometricDecoration } from '@/components/bauhaus/geometric-decoration'
import { GeometricComposition, GeometricLayer } from '@/components/bauhaus/geometric-composition'
import { CornerDecoration } from '@/components/bauhaus/corner-decoration'
import { CornerAccent, EditorialComposition, HeroComposition, SectionAccent } from '@/components/bauhaus/geometric-presets'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Radio } from '@/components/ui/radio'
import { Section } from '@/components/ui/section'
import { SectionHeading } from '@/components/ui/section-heading'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Container } from '@/components/layout/container'
import { Grid } from '@/components/layout/grid'
import { Stack } from '@/components/layout/stack'
import { Cluster } from '@/components/layout/cluster'
import { Split } from '@/components/layout/split'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { AnnouncementBar } from '@/components/layout/announcement-bar'
import { GlobalCTA } from '@/components/layout/global-cta'
import { SectionDivider } from '@/components/layout/section-divider'

export default function ComponentShowcase() {
  if (process.env.NODE_ENV !== 'development') notFound()

  return (
    <div className="min-h-screen bg-background">
      <Section>
        <SectionHeading
          eyebrow="Development / UI system"
          title="Bauhaus component showcase"
          description="Development-only verification surface for reusable Phase 1.5 primitives."
        />

        <Divider className="my-10" />

        <section aria-labelledby="header-navigation">
          <h2 id="header-navigation" className="mb-5 text-2xl font-900 uppercase">Header / navigation</h2>
          <div className="overflow-hidden border-4 border-border bg-background">
            <Header />
            <div className="border-t-2 border-border bg-white p-5">
              <p className="text-xs font-900 uppercase tracking-[.2em] text-primary-blue">Responsive verification</p>
              <p className="mt-2 max-w-2xl">Resize below 768px to verify the mobile trigger and drawer. The production header uses the shared navigation configuration and no business data.</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="global-sections">
          <h2 id="global-sections" className="mb-5 text-2xl font-900 uppercase">Global sections</h2>
          <div className="space-y-8">
            <div className="overflow-hidden border-4 border-border">
              <AnnouncementBar message="Foundation announcement" href="/" linkLabel="View home" />
            </div>
            <SectionDivider accent="blue" />
            <GlobalCTA
              heading="A reusable final action"
              description="Presentation-only CTA structure with configurable actions and geometry."
              primaryAction={{ label: 'Go home', href: '/' }}
            />
            <div className="overflow-hidden border-4 border-border">
              <Footer />
            </div>
          </div>
        </section>

        <section aria-labelledby="layout-architecture" className="space-y-10">
          <div>
            <h2 id="layout-architecture" className="mb-3 text-2xl font-900 uppercase">Global layout architecture</h2>
            <p className="max-w-2xl">Reusable layout primitives keep full-width structure separate from constrained content while preserving mobile-first reading order.</p>
          </div>

          <div className="border-4 border-border bg-white">
            <Container>
              <div className="py-8">
                <p className="text-xs font-900 uppercase tracking-[.25em] text-primary-blue">Container / standard</p>
                <p className="mt-2 text-lg font-700">Standard content alignment uses max-w-7xl.</p>
              </div>
            </Container>
          </div>

          <Section fullWidth background="bg-primary-yellow" divider>
            <Stack gap="lg">
              <div>
                <p className="text-xs font-900 uppercase tracking-[.25em]">Full-width section</p>
                <h3 className="mt-2">Color block + constrained content</h3>
              </div>
              <Grid columns={1} tabletColumns={2} desktopColumns={3}>
                <div className="border-2 border-border bg-white p-5">Mobile: 1 column</div>
                <div className="border-2 border-border bg-white p-5">Tablet: 2 columns</div>
                <div className="border-2 border-border bg-white p-5">Desktop: 3 columns</div>
              </Grid>
            </Stack>
          </Section>

          <div className="border-4 border-border bg-background p-6">
            <Cluster gap="md" justify="between">
              <span className="font-900 uppercase">Cluster</span>
              <Cluster gap="sm"><span className="border-2 border-border px-3 py-2 text-xs font-900 uppercase">One</span><span className="border-2 border-border px-3 py-2 text-xs font-900 uppercase">Two</span></Cluster>
            </Cluster>
          </div>

          <div className="border-4 border-border bg-white p-6">
            <Split>
              <Stack gap="sm">
                <p className="text-xs font-900 uppercase tracking-[.25em] text-primary-red">Split / content</p>
                <h3>Intentional asymmetry</h3>
                <p>Two-sided layouts use CSS Grid while preserving normal document order.</p>
              </Stack>
              <div className="min-h-40 bg-primary-blue p-6 text-white"><p className="text-xs font-900 uppercase tracking-[.25em] text-primary-yellow">Media placeholder</p></div>
            </Split>
          </div>
        </section>

        <div className="grid gap-12">
          <section aria-labelledby="buttons">
            <h2 id="buttons" className="mb-5 text-2xl font-900 uppercase">Buttons</h2>
            <div className="flex flex-wrap gap-4">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="yellow">Yellow</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button loading>Loading</Button>
              <Button href="#cards">Link button</Button>
            </div>
          </section>

          <section id="cards" aria-labelledby="cards-heading">
            <h2 id="cards-heading" className="mb-5 text-2xl font-900 uppercase">Cards</h2>
            <Card>
              <CardHeader>
                <CardTitle>Reusable card</CardTitle>
                <CardDescription>Composable structure with no store-specific behavior.</CardDescription>
              </CardHeader>
              <CardContent><p>Card content can contain any presentation-only children.</p></CardContent>
              <CardFooter><Badge variant="blue">Foundation</Badge><span className="text-sm font-700 uppercase">Composable</span></CardFooter>
            </Card>
          </section>

          <section aria-labelledby="forms">
            <h2 id="forms" className="mb-5 text-2xl font-900 uppercase">Forms</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <FormField label="Name" htmlFor="showcase-name" required description="Helper text uses the global form typography.">
                <Input id="showcase-name" name="name" placeholder="Your name" />
              </FormField>
              <FormField label="Category" htmlFor="showcase-category">
                <Select id="showcase-category" name="category" defaultValue="">
                  <option value="" disabled>Select a category</option>
                  <option value="shirts">Shirts</option>
                  <option value="accessories">Accessories</option>
                </Select>
              </FormField>
              <FormField label="Message" htmlFor="showcase-message" error="This field needs attention.">
                <Textarea id="showcase-message" name="message" aria-invalid="true" placeholder="Write a message" />
              </FormField>
              <div className="space-y-4">
                <Label htmlFor="showcase-check">Preferences</Label>
                <label className="flex items-center gap-3 text-sm font-700 uppercase">
                  <Checkbox id="showcase-check" name="preference" value="updates" />
                  Receive updates
                </label>
                <label className="flex items-center gap-3 text-sm font-700 uppercase">
                  <Radio id="showcase-radio-a" name="size" value="small" defaultChecked />
                  Small
                </label>
                <label className="flex items-center gap-3 text-sm font-700 uppercase">
                  <Radio id="showcase-radio-b" name="size" value="large" />
                  Large
                </label>
              </div>
            </div>
          </section>

          <section aria-labelledby="badges">
            <h2 id="badges" className="mb-5 text-2xl font-900 uppercase">Badges / status</h2>
            <div className="flex flex-wrap gap-3">
              <Badge>Neutral</Badge>
              <Badge variant="red">Red</Badge>
              <Badge variant="blue">Blue</Badge>
              <Badge variant="yellow">Yellow</Badge>
              <Badge variant="outline">Outline</Badge>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Alert variant="information">A reusable informational status message.</Alert>
              <Alert variant="success">A successful operation can use the yellow system signal.</Alert>
              <Alert variant="warning">A warning uses the same controlled palette.</Alert>
              <Alert variant="error">An error uses the primary red signal.</Alert>
            </div>
          </section>

          <section aria-labelledby="icons">
            <h2 id="icons" className="mb-5 text-2xl font-900 uppercase">Icons / decorations</h2>
            <div className="flex flex-wrap items-center gap-6">
              <IconButton label="Search"><Search size={20} strokeWidth={3} /></IconButton>
              <IconButton label="Shopping bag"><ShoppingBag size={20} strokeWidth={3} /></IconButton>
              <GeometricDecoration shape="circle" color="red" />
              <GeometricDecoration shape="square" color="blue" />
              <GeometricDecoration shape="triangle" color="yellow" />
              <GeometricDecoration shape="diamond" color="red" />
              <GeometricDecoration shape="line" color="blue" />
            </div>
          </section>

          <section aria-labelledby="accordion">
            <h2 id="accordion" className="mb-5 text-2xl font-900 uppercase">Accordion</h2>
            <Accordion>
              <AccordionItem title="What is this component?" defaultOpen>
                <p>It is a reusable accessible disclosure primitive with native button keyboard behavior.</p>
              </AccordionItem>
              <AccordionItem title="Does it contain business logic?">
                <p>No. It only owns presentation and local open/closed interaction state.</p>
              </AccordionItem>
            </Accordion>
          </section>

          <section aria-labelledby="geometry">
            <h2 id="geometry" className="mb-5 text-2xl font-900 uppercase">Geometric system</h2>
            <div className="grid gap-8">
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-5">
                <div className="space-y-3"><GeometricDecoration shape="circle" color="red" size="lg" /><p className="text-xs font-700 uppercase">Circle</p></div>
                <div className="space-y-3"><GeometricDecoration shape="square" color="blue" size="lg" /><p className="text-xs font-700 uppercase">Square</p></div>
                <div className="space-y-3"><GeometricDecoration shape="triangle" color="yellow" size="lg" /><p className="text-xs font-700 uppercase">Triangle</p></div>
                <div className="space-y-3"><GeometricDecoration shape="diamond" color="red" size="lg" /><p className="text-xs font-700 uppercase">Diamond</p></div>
                <div className="space-y-3"><GeometricDecoration shape="line" color="blue" /><p className="text-xs font-700 uppercase">Bar</p></div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <GeometricComposition className="min-h-64 border-4 border-border bg-white" label="Decorative overlapping geometric composition">
                  <GeometricLayer layer="back" className="right-4 top-4"><GeometricDecoration shape="circle" color="red" size="xl" /></GeometricLayer>
                  <GeometricLayer layer="base" className="bottom-8 left-8"><GeometricDecoration shape="square" color="blue" size="lg" rotation={45} /></GeometricLayer>
                  <GeometricLayer layer="front" className="bottom-8 right-1/3"><GeometricDecoration shape="triangle" color="yellow" size="md" rotation={-45} /></GeometricLayer>
                  <div className="relative p-6"><p className="text-xs font-900 uppercase tracking-[.25em]">Controlled layers</p><p className="mt-3 max-w-sm text-lg font-700">Geometry stays behind content and never owns interaction.</p></div>
                </GeometricComposition>

                <div className="relative min-h-64 border-4 border-border bg-background p-6">
                  <CornerDecoration placement="top-right" />
                  <CornerDecoration placement="bottom-left" />
                  <p className="relative z-10 max-w-sm text-lg font-700">Corner decorations remain pointer-transparent and outside the content flow.</p>
                </div>
              </div>

              <div className="grid gap-8 overflow-hidden border-4 border-border bg-white p-6 md:grid-cols-2">
                <div><p className="mb-4 text-xs font-900 uppercase tracking-[.25em]">Presets</p><CornerAccent placement="top-right" /><HeroComposition /><SectionAccent /></div>
                <div><p className="mb-4 text-xs font-900 uppercase tracking-[.25em]">Editorial</p><EditorialComposition /></div>
              </div>
            </div>
          </section>

          <section aria-labelledby="states">
            <h2 id="states" className="mb-5 text-2xl font-900 uppercase">Interaction states</h2>
            <div className="flex flex-wrap gap-4">
              <Button disabled>Disabled</Button>
              <IconButton label="Disabled search" disabled><Search size={20} /></IconButton>
              <Button className="focus-visible:ring-0"><ChevronRight size={18} /> Focus with keyboard</Button>
            </div>
          </section>
        </div>
      </Section>
    </div>
  )
}
