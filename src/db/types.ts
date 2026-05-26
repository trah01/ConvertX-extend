export class Filename {
  id!: number;
  job_id!: number;
  file_name!: string;
  output_file_name!: string;
  status!: string;
  error_message?: string;
}

export class Jobs {
  finished_files!: number;
  id!: number;
  user_id!: number;
  date_created!: string;
  status!: string;
  num_files!: number;
  files_detailed!: Filename[];
}

export class User {
  id!: number;
  username!: string;
  password!: string;
  is_admin!: number;
}
