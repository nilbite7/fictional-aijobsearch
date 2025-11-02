
import React, { useState, useCallback } from 'react';
import { Header } from './components/Header';
import { SearchBar } from './components/SearchBar';
import { JobList } from './components/JobList';
import { getAIRecommendations, searchJobs } from './services/geminiService';
import type { JobWithRecommendation, Job, SearchSource } from './types';
import { readFileAsText } from './utils/fileReader';
import { Spinner } from './components/Spinner';

const JOB_PAGE_SIZE = 6;

export default function App() {
  const [jobs, setJobs] = useState<JobWithRecommendation[]>([]);
  const [sources, setSources] = useState<SearchSource[]>([]);
  const [resumeText, setResumeText] = useState<string | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSearch, setCurrentSearch] = useState<{ query: string; location: string } | null>(null);
  const [hasMoreJobs, setHasMoreJobs] = useState<boolean>(false);

  const handleResumeUpload = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);
    try {
      const text = await readFileAsText(file);
      setResumeText(text);
      setResumeFile(file);
      // If jobs are already loaded, re-evaluate them with the new resume
      if (jobs.length > 0) {
        const currentJobsOnly: Job[] = jobs.map(({ recommendation, matchScore, ...job }) => job);
        setJobs(currentJobsOnly.map(job => ({ ...job, recommendation: 'Analyzing fit...', matchScore: null })));
        const jobsWithRecs = await getAIRecommendations(text, currentJobsOnly);
        setJobs(jobsWithRecs);
      }
    } catch (err) {
      setError('Failed to read resume file. Please try a different file.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [jobs]);

  const handleSearch = useCallback(async (query: string, location: string) => {
    if (!query && !location) return;

    setIsLoading(true);
    setError(null);
    setJobs([]);
    setSources([]);
    setCurrentSearch({ query, location });
    setHasMoreJobs(false);

    try {
      const { jobs: initialJobs, sources: newSources } = await searchJobs(query, location, 0);
      setSources(newSources);
      
      if (initialJobs.length > 0) {
        setHasMoreJobs(initialJobs.length === JOB_PAGE_SIZE);

        if (!resumeText) {
          setJobs(initialJobs.map(job => ({ ...job, recommendation: null, matchScore: null })));
          return;
        }
        
        setJobs(initialJobs.map(job => ({ ...job, recommendation: 'Analyzing fit...', matchScore: null })));

        const jobsWithRecs = await getAIRecommendations(resumeText, initialJobs);
        setJobs(jobsWithRecs);
      } else {
        setJobs([]);
      }
    } catch (err) {
      console.error('An error occurred during search:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred. Please try again.';
      setError(`Failed to get job listings. ${errorMessage}`);
      setJobs([]);
    } finally {
      setIsLoading(false);
    }
  }, [resumeText]);

  const handleLoadMore = useCallback(async () => {
    if (!currentSearch || isLoadingMore || !hasMoreJobs) return;

    setIsLoadingMore(true);
    setError(null);

    try {
      const offset = jobs.length;
      const { jobs: newJobs, sources: newSources } = await searchJobs(currentSearch.query, currentSearch.location, offset);
      
      setHasMoreJobs(newJobs.length === JOB_PAGE_SIZE);
      
      setSources(prevSources => {
        const existingUris = new Set(prevSources.map(s => s.uri));
        const uniqueNewSources = newSources.filter(s => s.uri && !existingUris.has(s.uri));
        return [...prevSources, ...uniqueNewSources];
      });

      if (newJobs.length > 0) {
        if (!resumeText) {
          const newJobsWithRecs = newJobs.map(job => ({ ...job, recommendation: null, matchScore: null }));
          setJobs(prevJobs => [...prevJobs, ...newJobsWithRecs]);
          return;
        }

        const newJobsWithRecs = await getAIRecommendations(resumeText, newJobs);
        setJobs(prevJobs => [...prevJobs, ...newJobsWithRecs]);
      }
    } catch (err) {
      console.error('An error occurred while loading more jobs:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred. Please try again.';
      setError(`Failed to load more jobs. ${errorMessage}`);
    } finally {
      setIsLoadingMore(false);
    }
  }, [currentSearch, jobs.length, resumeText, isLoadingMore, hasMoreJobs]);


  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-sans">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-slate-600 dark:text-slate-400 mb-6">
            Enter a job title or location to start, or upload your resume to get personalized AI-powered recommendations.
          </p>
          <SearchBar
            onSearch={handleSearch}
            onFileUpload={handleResumeUpload}
            isLoading={isLoading || isLoadingMore}
            resumeFileName={resumeFile?.name}
          />
          {error && (
            <div className="mt-4 text-center text-red-500 bg-red-100 dark:bg-red-900/20 p-3 rounded-lg">
              <p><strong>Error:</strong> {error}</p>
            </div>
          )}
          <div className="mt-12">
            <JobList jobs={jobs} isLoading={isLoading} sources={sources} />
            {hasMoreJobs && !isLoading && (
              <div className="text-center mt-8">
                <button
                  onClick={handleLoadMore}
                  className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-900 transition-colors duration-200 disabled:bg-indigo-400 disabled:cursor-wait flex items-center justify-center mx-auto"
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <>
                      <Spinner /> <span className="ml-2">Loading More...</span>
                    </>
                  ) : 'Load More'}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
