
export interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  postedDate: string;
}

export interface JobRecommendation {
  id: number;
  matchScore: number;
  recommendation: string;
}

export interface JobWithRecommendation extends Job {
  recommendation: string | null;
  matchScore: number | null;
}

export interface SearchSource {
  uri: string;
  title: string;
}
