import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Trophy, ThumbsUp, Users, Folder, TrendingUp } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from './ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { getAnnotationApiUrl } from '../utils/apiConfig';

interface CreatorStats {
  username: string;
  ruleCount: number;
  totalSupports: number;
  totalContests: number;
  projectCount: number;
}

interface ProjectStats {
  projectId: number;
  projectName: string;
  projectDescription: string;
  createdBy: string;
  ruleCount: number;
  totalSupports: number;
  totalContests: number;
  memberCount: number;
}

export function CommunityStats() {
  const [topCreators, setTopCreators] = useState<CreatorStats[]>([]);
  const [mostSupportedCreators, setMostSupportedCreators] = useState<CreatorStats[]>([]);
  const [topProjects, setTopProjects] = useState<ProjectStats[]>([]);
  const [mostSupportedProjects, setMostSupportedProjects] = useState<ProjectStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper function to get back-to-map URL with last species context
  const getBackToMapUrl = () => {
    try {
      const lastSpeciesStr = localStorage.getItem('lastSelectedSpecies');
      if (lastSpeciesStr) {
        const lastSpecies = JSON.parse(lastSpeciesStr);
        return `/?taxonKey=${lastSpecies.key}`;
      }
    } catch (error) {
      console.error('Error loading last species for navigation:', error);
    }
    return '/';
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);

        const [creatorsRes, supportedCreatorsRes, projectsRes, supportedProjectsRes] = 
          await Promise.all([
            fetch(getAnnotationApiUrl('/stats/top-creators?limit=20')),
            fetch(getAnnotationApiUrl('/stats/most-supported-creators?limit=20')),
            fetch(getAnnotationApiUrl('/stats/top-projects?limit=20')),
            fetch(getAnnotationApiUrl('/stats/most-supported-projects?limit=20'))
          ]);

        if (!creatorsRes.ok || !supportedCreatorsRes.ok || !projectsRes.ok || !supportedProjectsRes.ok) {
          throw new Error('Failed to fetch community statistics');
        }

        const [creators, supportedCreators, projects, supportedProjects] = await Promise.all([
          creatorsRes.json(),
          supportedCreatorsRes.json(),
          projectsRes.json(),
          supportedProjectsRes.json()
        ]);

        setTopCreators(creators);
        setMostSupportedCreators(supportedCreators);
        setTopProjects(projects);
        setMostSupportedProjects(supportedProjects);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (index === 1) return <Trophy className="h-5 w-5 text-gray-400" />;
    if (index === 2) return <Trophy className="h-5 w-5 text-orange-600" />;
    return <span className="text-muted-foreground">#{index + 1}</span>;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 max-w-7xl">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-2 text-muted-foreground">Loading community statistics...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 max-w-7xl">
        <div className="mb-6">
          <Link to={getBackToMapUrl()} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Map
          </Link>
        </div>
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded">
          <p className="font-medium">Error loading statistics</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <Link to={getBackToMapUrl()} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Map
        </Link>
        <div className="flex items-center gap-3">
          <TrendingUp className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Community Statistics</h1>
            <p className="text-muted-foreground">
              Top contributors and projects in the GBIF annotation community
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="creators" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="creators">
            <Users className="mr-2 h-4 w-4" />
            Top Creators
          </TabsTrigger>
          <TabsTrigger value="projects">
            <Folder className="mr-2 h-4 w-4" />
            Top Projects
          </TabsTrigger>
        </TabsList>

        {/* Top Creators Tab */}
        <TabsContent value="creators" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Most Prolific Creators */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  Most Prolific Creators
                </CardTitle>
                <CardDescription>
                  Users with the most annotation rules created
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Rank</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead className="text-right">Rules</TableHead>
                      <TableHead className="text-right">Supports</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topCreators.map((creator, index) => (
                      <TableRow key={creator.username}>
                        <TableCell className="font-medium">
                          {getRankIcon(index)}
                        </TableCell>
                        <TableCell>
                          <Link 
                            to={`/user/${creator.username}`}
                            className="font-medium hover:underline"
                          >
                            {creator.username}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{creator.ruleCount}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <ThumbsUp className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">{creator.totalSupports}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Most Supported Creators */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ThumbsUp className="h-5 w-5 text-primary" />
                  Most Supported Creators
                </CardTitle>
                <CardDescription>
                  Users with the most community support for their rules
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Rank</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead className="text-right">Supports</TableHead>
                      <TableHead className="text-right">Rules</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mostSupportedCreators.map((creator, index) => (
                      <TableRow key={creator.username}>
                        <TableCell className="font-medium">
                          {getRankIcon(index)}
                        </TableCell>
                        <TableCell>
                          <Link 
                            to={`/user/${creator.username}`}
                            className="font-medium hover:underline"
                          >
                            {creator.username}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <ThumbsUp className="h-3 w-3 text-muted-foreground" />
                            <Badge variant="secondary">{creator.totalSupports}</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm text-muted-foreground">{creator.ruleCount}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Top Projects Tab */}
        <TabsContent value="projects" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Most Active Projects */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  Most Active Projects
                </CardTitle>
                <CardDescription>
                  Projects with the most annotation rules
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Rank</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead className="text-right">Rules</TableHead>
                      <TableHead className="text-right">Supports</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topProjects.map((project, index) => (
                      <TableRow key={project.projectId}>
                        <TableCell className="font-medium">
                          {getRankIcon(index)}
                        </TableCell>
                        <TableCell>
                          <div>
                            <Link 
                              to={`/project/${project.projectId}`}
                              className="font-medium hover:underline"
                            >
                              {project.projectName}
                            </Link>
                            <p className="text-xs text-muted-foreground mt-1">
                              by {project.createdBy}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{project.ruleCount}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <ThumbsUp className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">{project.totalSupports}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Most Supported Projects */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ThumbsUp className="h-5 w-5 text-primary" />
                  Most Supported Projects
                </CardTitle>
                <CardDescription>
                  Projects with the most community support
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Rank</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead className="text-right">Supports</TableHead>
                      <TableHead className="text-right">Rules</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mostSupportedProjects.map((project, index) => (
                      <TableRow key={project.projectId}>
                        <TableCell className="font-medium">
                          {getRankIcon(index)}
                        </TableCell>
                        <TableCell>
                          <div>
                            <Link 
                              to={`/project/${project.projectId}`}
                              className="font-medium hover:underline"
                            >
                              {project.projectName}
                            </Link>
                            <p className="text-xs text-muted-foreground mt-1">
                              by {project.createdBy} • {project.memberCount || 0} members
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <ThumbsUp className="h-3 w-3 text-muted-foreground" />
                            <Badge variant="secondary">{project.totalSupports}</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm text-muted-foreground">{project.ruleCount}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
